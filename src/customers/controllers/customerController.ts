import { NextFunction, Request, Response } from "express";
import db from "../../config/db";
import { getCache, setCache } from "../../utils/cache";

const filterHotelsByCityAndCountry = async (req: Request, res: Response, next: NextFunction) => {
  let connection;
  try{
    connection = await db.getConnection();
    
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const limit = 10;
    const offset = (page - 1) * limit;
    //const sortHotelByRoomAvailability = (req.query.sortHotelByRoomAvailability as string)?.toLowerCase() || "";
    const searchCity = (req.query.city as string)?.toLowerCase() || "";
    const country = (req.query.country as string)?.toLowerCase() || "";
    const cacheKey = `customers-hotels:searchCity=${searchCity}:country=${country}`;
    const cached = getCache<any>(cacheKey);

    if (cached) {
      console.log("⚡ Cache hit:", cacheKey);
      return res.status(200).json(cached);
    }

    console.log("🕵️ Cache miss:", cacheKey);

    // 🔹 Step 1: Get paginated hotels
    const [hotels] = await connection.query<any[]>(
      `SELECT hotel_id, hotel_name, city, country, total_rooms
       FROM hotels
       WHERE LOWER(city) LIKE ? AND LOWER(country) LIKE ?
       LIMIT ? OFFSET ?
       `,
     [`%${searchCity}%`, `%${country}%`, limit, offset]

    );
    console.log(hotels);
    if (hotels.length === 0) {
      return res.status(200).json({
        success: true,
        data: [],
        message: "No hotels found",
      });
    }

    const hotelIds = hotels.map((h) => h.hotel_id);

    // 🔹 Step 2: Get rooms and their availability
    const [rooms] = await connection.query<any[]>(
      `SELECT hotel_id,room_number, room_type, price_per_night, is_available
       FROM rooms
       WHERE hotel_id IN (?)`,
    
      [hotelIds]
    );
    const availableRoomsCount: Record<string, number> = {};
    for (const room of rooms) {
      
        availableRoomsCount[room.hotel_id] =availableRoomsCount[room.hotel_id] || 0 ;
      
    }
    // 🔹 Step 3: Get services
    const [services] = await connection.query<any[]>(
      `SELECT hotel_id, service_id, service_name, service_charge
       FROM services
       WHERE hotel_id IN (?)`,
      [hotelIds]
    );


    const [reviews]= await connection.query<any[]>(
      `SELECT hotel_id, rating, 
      comment,review_date, cust.customer_name
      FROM reviews
       LEFT JOIN(
       SELECT customer_id, full_name AS customer_name
       FROM customers
       )AS cust ON reviews.customer_id = cust.customer_id
       WHERE hotel_id IN (?)`,
      [hotelIds]
    );
const [reviewSummary] = await connection.query<any[]>(
  `SELECT hotel_id,
          ROUND(AVG(rating), 2) AS avg_rating,
          COUNT(*) AS total_reviews
   FROM reviews
   WHERE hotel_id IN (?)
   GROUP BY hotel_id`,
  [hotelIds]
);

const [averagePriceSummary] = await connection.query<any[]>(
  `SELECT hotel_id,
          ROUND(AVG(price_per_night), 2) AS avg_price_per_night
   FROM rooms
   WHERE hotel_id IN (?)
   GROUP BY hotel_id`,
  [hotelIds]
);
console.log(averagePriceSummary);

const averagePriceOfHotels: Record<string, { avg_price_per_night: number }> = {};
for (const summary of averagePriceSummary) {
  averagePriceOfHotels[summary.hotel_id] = {
    avg_price_per_night: summary.avg_price_per_night,
  };
}

// 🔹 Map average ratings for quick lookup
const averageRatingOfHotels: Record<string, { avg_rating: number; total_reviews: number }> = {};
for (const summary of reviewSummary) {
  averageRatingOfHotels[summary.hotel_id] = {
    avg_rating: summary.avg_rating,
    total_reviews: summary.total_reviews,
    
  };
}



    // 🔹 Step 4: Aggregate rooms & services by hotel
    const hotelMap: Record<string, any> = {};

    for (const hotel of hotels) {
      hotelMap[hotel.hotel_id] = {
        ...hotel,
        total_rooms_available: availableRoomsCount[hotel.hotel_id] || 0, // ✅ computed
                 average_rating: averageRatingOfHotels[hotel.hotel_id]?.avg_rating || 0,
    total_reviews: averageRatingOfHotels[hotel.hotel_id]?.total_reviews || 0,
        average_price_per_night: averagePriceOfHotels[hotel.hotel_id]?.avg_price_per_night || 0,
        rooms: [],
        services: [],
        reviews:[]
      };
    }

    // Aggregate rooms
    for (const room of rooms) {
      const h = hotelMap[room.hotel_id];
      if (h) {
        h.rooms.push({
          room_number: room.room_number,
          room_type: room.room_type,
          price_per_night: room.price_per_night,
          is_available: room.is_available,
        });
        if (room.is_available) h.total_rooms_available++;
      }
    }

    // Aggregate services
    for (const serv of services) {
      const h = hotelMap[serv.hotel_id];
      if (h) {
        h.services.push({
          service_id: serv.service_id,
          service_name: serv.service_name,
          service_charge: serv.service_charge,
        });
      }
    }
  for(const rev of reviews){
      hotelMap[rev.hotel_id].reviews.push({
        customer_name: rev.customer_name,
        rating: rev.rating,
        comment: rev.comment,
        review_date: rev.review_date
      })
    }

    // 🔹 Step 5: Sort hotels by available rooms (in-memory)
    let sortedHotels = Object.values(hotelMap);
    // if (searchCity === "low to high") {
    //   sortedHotels = sortedHotels.sort((a, b) => a.total_rooms_available - b.total_rooms_available);
    // } else if (searchCity === "high to low") {
    //   sortedHotels = sortedHotels.sort((a, b) => b.total_rooms_available - a.total_rooms_available);
    // }

    // 🔹 Step 6: Get total count
    //const [countResult] = await connection.query<any[]>(`SELECT COUNT(*) AS total FROM hotels`);
const [countResult] = await connection.query<any[]>(
  `SELECT COUNT(*) AS total 
   FROM hotels 
   WHERE LOWER(city) LIKE ? AND LOWER(country) LIKE ?`,
  [`%${searchCity}%`, `%${country}%`]
);

    const responseData = {
      success: true,
      totalPages: Math.ceil(countResult[0].total / limit),
      currentPage: page,
      totalHotels: countResult[0].total,
   
      data: sortedHotels,
    };

    setCache(cacheKey, responseData, 300);
    return res.status(200).json(responseData);

  } catch (err: any) {
     if (connection) connection.release();
    console.error("❌ Error filtering hotels:", err.message);
    next(err);
  } finally {
    if (connection) connection.release();
  
  }
};

const getBookingsHistoryForCustomer = async (req: Request, res: Response, next: NextFunction) => {
  // Implementation here
  let connection;
  try{
     connection = await db.getConnection();
    
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const limit = 10;
    const offset = (page - 1) * limit;
    const customerId = req.params.customerId;

 const cacheKey = `customers-bookings:${customerId}:page=${page}`;

    const cached = getCache<any>(cacheKey);

    if (cached) {
      console.log("⚡ Cache hit:", cacheKey);
      return res.status(200).json(cached);
    }

    console.log("🕵️ Cache miss:", cacheKey);
    const [bookings] = await connection.query<any[]>(
  `
  SELECT 
    h.hotel_name,
    b.booking_id, 
    b.hotel_id, 
    b.customer_id, 
    b.total_amount, 
    b.booking_status,
    cust.full_name AS customer_name,
    br.room_number, 
    br.check_in, 
    br.check_out, 
    br.room_amount,
    br.booking_room_id,
    bc.cancel_reasons
  FROM bookings b
  LEFT JOIN customers cust ON b.customer_id = cust.customer_id
  LEFT JOIN booking_rooms br ON b.booking_id = br.booking_id
  JOIN hotels h ON b.hotel_id = h.hotel_id
  LEFT JOIN bookings_cancelled bc ON b.booking_id = bc.booking_id
    WHERE b.customer_id = ?
  ORDER BY b.created_at DESC
   LIMIT ? OFFSET ?
  `,
  [customerId, limit, offset]
 
);

const bookingMap: Record<string, any> = {};
for(const booking of bookings){
    if(!bookingMap[booking.booking_id]){
        bookingMap[booking.booking_id]={
            hotelName: booking.hotel_name,
            booking_id: booking.booking_id,
            hotel_id: booking.hotel_id,
                cancel_reasons: booking.cancel_reasons,
            total_amount: booking.total_amount,
            booking_status: booking.booking_status,
            customer_name: booking.customer_name,
            rooms:[]
            
        }
    }
    bookingMap[booking.booking_id].rooms.push({
        room_number: booking.room_number,
        check_in: booking.check_in,
        check_out: booking.check_out,
        room_amount: booking.room_amount,
        booking_room_id: booking.booking_room_id
    })
}
const [totalBookings] = await connection.query<any[]>(
  `SELECT COUNT(DISTINCT booking_id) AS total 
   FROM bookings 
   WHERE customer_id = ?`,
  [customerId]
);


const bookingHistory=Object.values(bookingMap);
    const responseData = {
      success: true,
      currentPage: page,
      totalBookings: totalBookings[0].total,
      totalPages: Math.ceil(totalBookings[0].total / limit),
      bookings: bookingHistory,
    };

    setCache(cacheKey, responseData, 300);
    return res.status(200).json(responseData);

}catch (err: any) {
     if (connection) connection.release();
    console.error("❌ Error filtering hotels:", err.message);
    next(err);
  } finally {
    if (connection) connection.release();
    }   

}

const filterHotelRoomsByPricePerNightRatings = async (req: Request, res: Response, next: NextFunction) => {

let connection;
  try{
    connection = await db.getConnection();
    
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const limit = 10;
    const offset = (page - 1) * limit;
    //const sortHotelByRoomAvailability = (req.query.sortHotelByRoomAvailability as string)?.toLowerCase() || "";

    const minPrice = req.query.minPrice ? parseFloat(req.query.minPrice as string) : 0;
    const maxPrice = req.query.maxPrice ? parseFloat(req.query.maxPrice as string) : 100000; // default high range
    const minRating = req.query.minRating ? parseFloat(req.query.minRating as string) : 0;
 const cacheKey = `customers-hotels-rooms-price:${minPrice}-${maxPrice}:minRating=${minRating}:page=${page}`;
    const cached = getCache<any>(cacheKey);

    if (cached) {
      console.log("⚡ Cache hit:", cacheKey);
      return res.status(200).json(cached);
    }

    console.log("🕵️ Cache miss:", cacheKey);



    // 🔹 Step 1: Get paginated hotels
     const [hotels] = await connection.query<any[]>(
      `
      SELECT DISTINCT h.hotel_id, h.hotel_name, h.city, h.country, h.total_rooms
      FROM hotels h
      INNER JOIN rooms r ON h.hotel_id = r.hotel_id

      ORDER BY h.created_at DESC
     
      LIMIT ? OFFSET ?
      `,
      [limit, offset]
    );
    console.log(hotels);
    if (hotels.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No hotels found with rooms in this price range",
        totalHotels: 0,
        totalPages: 0,
        currentPage: page,
        data: [],
      });
    }

    const hotelIds = hotels.map((h) => h.hotel_id);

    // ✅ STEP 2: Get rooms matching the price range for those hotels
    const [rooms] = await connection.query<any[]>(
      `
      SELECT 
        r.room_number,
        r.room_type,
        r.price_per_night,
        r.is_available,
        r.hotel_id
      FROM rooms r
      WHERE r.hotel_id IN (?)
      ORDER BY r.price_per_night ASC

      `,
      [hotelIds]
    );


    const availableRoomsCount: Record<string, number> = {};
    for (const room of rooms) {
      
        availableRoomsCount[room.hotel_id] =availableRoomsCount[room.hotel_id] || 0 ;
      
    }
    // 🔹 Step 3: Get services

    const [services] = await connection.query<any[]>(
      `SELECT hotel_id, service_id, service_name, service_charge
       FROM services
       WHERE hotel_id IN (?)`,
      [hotelIds]
    );


    const [reviews]= await connection.query<any[]>(
      `SELECT hotel_id, rating, 
      comment,review_date, cust.customer_name
      FROM reviews
       LEFT JOIN(
       SELECT customer_id, full_name AS customer_name
       FROM customers
       )AS cust ON reviews.customer_id = cust.customer_id
       WHERE hotel_id IN (?)`,
      [hotelIds]
    );
const [reviewSummary] = await connection.query<any[]>(
  `SELECT hotel_id,
          ROUND(AVG(rating), 2) AS avg_rating,
          COUNT(*) AS total_reviews
   FROM reviews
   WHERE hotel_id IN (?)
   GROUP BY hotel_id`,
  [hotelIds]
);


    const [averagePriceSummary] = await connection.query<any[]>(
      `SELECT hotel_id,
              ROUND(AVG(price_per_night), 2) AS avg_price_per_night
       FROM rooms
       WHERE hotel_id IN (?)
       GROUP BY hotel_id`,
      [hotelIds]
    );

const averagePriceOfHotels: Record<string, { avg_price_per_night: number }> = {};
for (const summary of averagePriceSummary) {
  averagePriceOfHotels[summary.hotel_id] = {
    avg_price_per_night: summary.avg_price_per_night,
  };
}

// 🔹 Map average ratings for quick lookup
const averageRatingOfHotels: Record<string, { avg_rating: number; total_reviews: number }> = {};
for (const summary of reviewSummary) {
  averageRatingOfHotels[summary.hotel_id] = {
    avg_rating: summary.avg_rating,
    total_reviews: summary.total_reviews,
    
  };
}



    // 🔹 Step 4: Aggregate rooms & services by hotel
    const hotelMap: Record<string, any> = {};

    for (const hotel of hotels) {
      hotelMap[hotel.hotel_id] = {
        ...hotel,
        total_rooms_available: availableRoomsCount[hotel.hotel_id] || 0, // ✅ computed
                 average_rating: averageRatingOfHotels[hotel.hotel_id]?.avg_rating || 0,
    total_reviews: averageRatingOfHotels[hotel.hotel_id]?.total_reviews || 0,
        average_price_per_night: averagePriceOfHotels[hotel.hotel_id]?.avg_price_per_night || 0,
    
   
   
        rooms: [],
        services: [],
        reviews:[]
      };
    }
  
    // Aggregate rooms
    for (const room of rooms) {
      const h = hotelMap[room.hotel_id];
      if (h) {
        h.rooms.push({
          room_number: room.room_number,
          room_type: room.room_type,
          price_per_night: room.price_per_night,
          is_available: room.is_available,
        });
        if (room.is_available) h.total_rooms_available++;
      }
    }

    // Aggregate services
    for (const serv of services) {
      const h = hotelMap[serv.hotel_id];
      if (h) {
        h.services.push({
          service_id: serv.service_id,
          service_name: serv.service_name,
          service_charge: serv.service_charge,
        });
      }
    }
  for(const rev of reviews){
      hotelMap[rev.hotel_id].reviews.push({
        customer_name: rev.customer_name,
        rating: rev.rating,
        comment: rev.comment,
        review_date: rev.review_date
      })
    }

    // 🔹 Step 5: Sort hotels by available rooms (in-memory)
    let sortedHotels = Object.values(hotelMap);

    if(minPrice>=0 && maxPrice && minRating){
      sortedHotels=sortedHotels.filter(h=>
        h.average_price_per_night>=Number(minPrice) &&
         h.average_price_per_night<=Number(maxPrice)
         && h.average_rating>=Number(minRating));
    }

console.log(sortedHotels.length);
    // 🔹 Step 6: Get total count
    //   const [countResult] = await connection.query<any[]>(
    //   `
    //   SELECT COUNT(DISTINCT h.hotel_id) AS total
    //   FROM hotels h
    //   INNER JOIN rooms r ON h.hotel_id = r.hotel_id
    //   WHERE r.price_per_night BETWEEN ? AND ? 
    //   `,
    //   [minPrice, maxPrice]
    // );
    // const [countResult] = await connection.query<any[]>(
    //   `
    //   SELECT COUNT(DISTINCT h.hotel_id) AS total
    //   FROM hotels h
    //   INNER JOIN rooms r ON h.hotel_id = r.hotel_id
    //   LEFT JOIN (
    //     SELECT hotel_id, AVG(rating) AS avg_rating FROM reviews GROUP BY hotel_id
    //   ) rev ON h.hotel_id = rev.hotel_id
    //   WHERE r.price_per_night BETWEEN ? AND ?
    //     AND (rev.avg_rating IS NULL OR rev.avg_rating >= ?)
    //   `,
    //   [minPrice, maxPrice, Number(minRating)]
    // );
    //     const [countResult] = await connection.query<any[]>(
    //   `
    //   SELECT COUNT(*) AS total
    //   FROM (
    //     SELECT h.hotel_id
    //     FROM hotels h
    //     LEFT JOIN rooms   r  ON h.hotel_id = r.hotel_id
    //     LEFT JOIN reviews rv ON h.hotel_id = rv.hotel_id
    //     GROUP BY h.hotel_id
    //     HAVING COALESCE(ROUND(AVG(r.price_per_night), 2), 0) BETWEEN ? AND ?
    //        AND COALESCE(ROUND(AVG(rv.rating), 2), 0) >= ?
    //   ) AS filtered
    //   `,
    //   [minPrice, maxPrice, minRating]
    // );
    const filteredHotels = sortedHotels;
const totalHotels = filteredHotels.length;
const totalPages = Math.ceil(totalHotels / limit);

// Slice only the current page items (optional)
const paginatedHotels = filteredHotels.slice((page - 1) * limit, page * limit);

const responseData = {
  success: true,
  totalHotels,
  totalPages,
  currentPage: page,
  data: paginatedHotels,
};
    // const responseData = {
    //   success: true,
    //   totalPages: Math.ceil(countResult[0].total / limit),
    //   currentPage: page,
    //   totalHotels: countResult[0].total,
   
    //   data: sortedHotels
    // };

    setCache(cacheKey, responseData, 300);
    return res.status(200).json(responseData);

  } catch (err: any) {
     if (connection) connection.release();
    console.error("❌ Error filtering hotels:", err.message);
    next(err);
  } finally {
    if (connection) connection.release();
  
  }
}




export { filterHotelsByCityAndCountry, getBookingsHistoryForCustomer,
   filterHotelRoomsByPricePerNightRatings };