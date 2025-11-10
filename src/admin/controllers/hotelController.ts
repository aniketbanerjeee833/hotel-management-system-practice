    import { NextFunction, Request, Response } from "express";


import { sanitizeObject } from "../../utils/sanitizeInput";
import db from "../../config/db";
import { hotelSchema } from "../../validators/hotelSchema";
import { invalidateCacheFor } from "../../utils/invalidateCache";
import { getCache, setCache } from "../../utils/cache";


const addHotel = async (req: Request, res: Response, next: NextFunction) => {
  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    const cleanData = sanitizeObject(req.body);
    const validation = hotelSchema.safeParse(cleanData);

    if (!validation.success) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        errors: validation.error.issues.map(e => e.message),
      });
    }

    const { hotel_name, city, country,  total_rooms, rooms, services = [] } = validation.data;

    // 🔹 Generate hotel_id
    const [lastHotel] = await connection.query<any[]>
    (`SELECT hotel_id FROM hotels ORDER BY id DESC LIMIT 1`);
    let nextHotelNum = 1;
    if (lastHotel.length > 0) {
      nextHotelNum = Number(lastHotel[0].hotel_id.replace(/\D/g, "")) + 1;
    }
    const hotelId = "HOT" + nextHotelNum.toString().padStart(5, "0");

    // 🔹 Insert hotel
    await connection.query(
      `INSERT INTO hotels (hotel_id, hotel_name, city, country,  total_rooms)
       VALUES (?, ?, ?, ?, ?)`,
      [hotelId, hotel_name, city, country,  total_rooms]
    );

    // 🔹 Insert Rooms
    if (rooms.length > total_rooms) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: "Cannot insert more rooms than total_rooms value",
      });
    }
    
    const uniqueRoomNumbers = new Set();
    for (const room of rooms) {
        if(uniqueRoomNumbers.has(room.room_number)){
          await connection.rollback();
          return res.status(400).json({
            success: false,
            message: `Duplicate room number '${room.room_number}' found.`,
          });
        }
      uniqueRoomNumbers.add(room.room_number);
      const [lastRoom] = await connection.query<any[]>(`SELECT room_id FROM rooms ORDER BY id DESC LIMIT 1`);
      let nextRoomNum = 1;
      if (lastRoom.length > 0) {
        nextRoomNum = Number(lastRoom[0].room_id.replace(/\D/g, "")) + 1;
      }
      const roomId = "ROOM" + nextRoomNum.toString().padStart(5, "0");

      await connection.query(
        `INSERT INTO rooms (room_id, hotel_id, room_number, room_type, price_per_night, is_available)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [roomId, hotelId, room.room_number, room.room_type, room.price_per_night, room.is_available]
      );
    }

    // 🔹 Insert Services (if provided)
 
  
    const uniqueServiceNames = new Set();
  for (const service of services) {
    if (!service.service_name) continue;

    if (uniqueServiceNames.has(service.service_name.toLowerCase())) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: `Duplicate service name '${service.service_name}' detected.`,
      });
    }
    uniqueServiceNames.add(service.service_name.toLowerCase());

    const [lastService] = await connection.query<any[]>(
      `SELECT service_id FROM services ORDER BY id DESC LIMIT 1`
    );

    let nextServiceNum = 1;
    if (lastService.length > 0) {
      nextServiceNum =
        Number(lastService[0].service_id.replace(/\D/g, "")) + 1;
    }

    const serviceId = "SERV" + nextServiceNum.toString().padStart(5, "0");

    await connection.execute(
      `INSERT INTO services (service_id, hotel_id, service_name, service_charge)
       VALUES (?, ?, ?, ?)`,
      [serviceId, hotelId, service.service_name, service.service_charge]
    );
  }

    
    await connection.commit();
    invalidateCacheFor("hotels");
    return res.status(201).json({
      success: true,
      message: "New Hotel added successfully",
      hotelId,
    });

  } catch (err: any) {
    if (connection) await connection.rollback();
    console.error("❌ Error adding hotel:", err);
    next(err);
  } finally {
    if (connection) connection.release();
  }
};

const updateHotel = async (req: Request, res: Response, next: NextFunction) => {
  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    const hotelId = (req.query.hotelId as string | undefined)?.trim();
    console.log("Updating Hotel:", hotelId);

    if (!hotelId) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: "Hotel ID is required",
      });
    }

    const cleanData = sanitizeObject(req.body);
    const validation = hotelSchema.safeParse(cleanData);

    if (!validation.success) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        errors: validation.error.issues.map((e) => e.message),
      });
    }

    const {
      hotel_name,
      city,
      country,
      total_rooms,
      rooms,
      services = [],
    } = validation.data;

    // 🔹 Update hotel info
    await connection.execute(
      `UPDATE hotels SET hotel_name = ?, city = ?, country = ?, total_rooms = ?, 
      updated_at = NOW() WHERE hotel_id = ?`,

      [hotel_name, city, country, total_rooms, hotelId]
    );

    // 🔹 Handle Rooms
    const [existingRooms] = await connection.query<any[]>(
      `SELECT room_number FROM rooms WHERE hotel_id = ?`,
      [hotelId]
    );
    const existingRoomNumbers = existingRooms.map((r) => r.room_number);

    const roomsToAdd = rooms.filter(
      (r) => !existingRoomNumbers.includes(r.room_number)
    );
    const roomsToUpdate = rooms.filter((r) =>
      existingRoomNumbers.includes(r.room_number)
    );

    for (const room of roomsToAdd) {
      const [lastRoom] = await connection.query<any[]>(
        `SELECT room_id FROM rooms ORDER BY id DESC LIMIT 1`
      );
      let nextRoomNum = 1;
      if (lastRoom.length > 0) {
        nextRoomNum = Number(lastRoom[0].room_id.replace(/\D/g, "")) + 1;
      }
      const roomId = "ROOM" + nextRoomNum.toString().padStart(5, "0");
      await connection.execute(
        `INSERT INTO rooms (room_id, hotel_id, room_number, room_type, price_per_night, is_available,
        created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          roomId,
          hotelId,
          room.room_number,
          room.room_type,
          room.price_per_night,
          room.is_available,

        ]
      );
    }

    for (const room of roomsToUpdate) {
      await connection.execute(
        `UPDATE rooms 
         SET room_type = ?, price_per_night = ?, is_available = ?, updated_at = NOW()
         WHERE room_number = ? AND hotel_id = ?`,
        [room.room_type, room.price_per_night, room.is_available, room.room_number, hotelId]
      );
    }

    // 🔹 Handle Services
    const [existingServices] = await connection.query<any[]>(
      `SELECT service_id FROM services WHERE hotel_id = ?`,
      [hotelId]
    );
    const existingServiceIds = existingServices.map((s) => s.service_id);

    const servicesToAdd = services.filter(
      (s) => !s.service_id || !existingServiceIds.includes(s.service_id)
    );
    const servicesToUpdate = services.filter(
      (s) => s.service_id && existingServiceIds.includes(s.service_id)
    );

    for (const service of servicesToAdd) {
      const [lastService] = await connection.query<any[]>(
        `SELECT service_id FROM services ORDER BY id DESC LIMIT 1`
      );
      let nextServiceNum = 1;
      if (lastService.length > 0) {
        nextServiceNum =
          Number(lastService[0].service_id.replace(/\D/g, "")) + 1;
      }
      const newServiceId = "SERV" + nextServiceNum.toString().padStart(5, "0");
      await connection.execute(
        `INSERT INTO services (service_id, hotel_id, service_name, service_charge, created_at,
         updated_at)
         VALUES (?, ?, ?, ?, NOW(), NOW())`,
        [newServiceId, hotelId, service.service_name, service.service_charge]
      );
    }

    for (const service of servicesToUpdate) {
      await connection.execute(
        `UPDATE services 
         SET service_name = ?, service_charge = ?, updated_at = NOW() 
         WHERE service_id = ? AND hotel_id = ?`,
        [service.service_name, service.service_charge, service.service_id, hotelId]
      );
    }
    invalidateCacheFor("hotels");
    await connection.commit();
    return res.status(200).json({
      success: true,
      message: "Hotel updated successfully",
    });
  } catch (err: any) {
    if (connection) await connection.rollback();
    console.error("❌ Error updating hotel:", err);
    next(err);
  } finally {
    if (connection) connection.release();
  }
};

const getAllHotelsWithRooms = async (req: Request, res: Response, next: NextFunction) => {
  let connection;
  try {
    connection = await db.getConnection();

    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const limit = 10;
    const offset = (page - 1) * limit;
    const cacheKey = `hotels:page=${page}`;

    const cached = getCache<any>(cacheKey);
    if (cached) {
      console.log("⚡ Cache hit:", cacheKey);
      return res.status(200).json(cached);
    }

    console.log("🕵️ Cache miss:", cacheKey);

    //  Fetch paginated hotels
    const [hotels] = await connection.query<any[]>(
      `SELECT hotel_id, hotel_name, city, country, total_rooms, created_at
       FROM hotels
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    const hotelIds = hotels.map((h) => h.hotel_id);

    if (hotelIds.length === 0) {
      return res.status(200).json({
        success: true,
        data: [],
        message: "No hotels found",
      });
    }

    //  Fetch rooms (with availability count per hotel)
  const [rooms] = await connection.query<any[]>(
      `SELECT hotel_id, room_number, room_type, price_per_night, is_available
       FROM rooms
       WHERE hotel_id IN (?)`,
      [hotelIds]
    );

    //  Aggregate available rooms by hotel_id
    const availableRoomsCount: Record<string, number> = {};
    
    for (const room of rooms) {
      if (room.is_available) {
        availableRoomsCount[room.hotel_id] =(availableRoomsCount[room.hotel_id] || 0) + 1;
      }
    }

    //  Fetch services
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

// const [bookings] = await connection.query<any[]>(
//   `SELECT hotel_id, cust.customer_name,br.*, COUNT(*) AS total_bookings 
//   FROM bookings
//   LEFT JOIN(
//     SELECT customer_id, full_name AS customer_name
//     FROM customers
//   )AS cust ON bookings.customer_id = cust.customer_id
//   LEFT JOIN booking_rooms br ON bookings.booking_id = br.booking_id


//    WHERE hotel_id IN (?)

//   GROUP BY hotel_id`,
//   [hotelIds]
// )
const [bookings] = await connection.query<any[]>(
  `
  SELECT 
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
    bc.cancel_reasons
  FROM bookings b
  LEFT JOIN customers cust ON b.customer_id = cust.customer_id
  LEFT JOIN booking_rooms br ON b.booking_id = br.booking_id
  LEFT JOIN bookings_cancelled bc ON b.booking_id = bc.booking_id
  WHERE b.hotel_id IN (?)
  ORDER BY b.created_at DESC
  `,
  [hotelIds]
);
const totalBookings: Record<string, number> = {};
for (const b of bookings) {
  if (b.booking_status !== "Cancelled") {
    totalBookings[b.hotel_id] = (totalBookings[b.hotel_id] || 0) + 1;
  }
}

console.log( bookings);
// 🔹 Map average ratings for quick lookup
const averageRatingOfHotels: Record<string, { avg_rating: number; total_reviews: number }> = {};
for (const summary of reviewSummary) {
  averageRatingOfHotels[summary.hotel_id] = {
    avg_rating: summary.avg_rating,
    total_reviews: summary.total_reviews,
  };
}
  

    // Combine everything
    const hotelMap: Record<string, any> = {};

    for (const hotel of hotels) {
      hotelMap[hotel.hotel_id] = {
        ...hotel,
        total_rooms_available: availableRoomsCount[hotel.hotel_id] || 0, // ✅ computed
           average_rating: averageRatingOfHotels[hotel.hotel_id]?.avg_rating || 0,
    total_reviews: averageRatingOfHotels[hotel.hotel_id]?.total_reviews || 0,
    totalBookings: totalBookings[hotel.hotel_id] || 0,
    
   
   
        //averageRatingOfHotels: averageRatingOfHotels[hotel.hotel_id] || 0,
        rooms: [],
        services: [],
        reviews:[],
        bookings:[]
      };
    }

    for (const room of rooms) {
      hotelMap[room.hotel_id].rooms.push({
        room_number: room.room_number,
        room_type: room.room_type,
        price_per_night: room.price_per_night,
        is_available: room.is_available,
      });
    }

    for (const serv of services) {
      hotelMap[serv.hotel_id].services.push({
        service_id: serv.service_id,
        service_name: serv.service_name,
        service_charge: serv.service_charge,
      });
    }
    for(const rev of reviews){
      hotelMap[rev.hotel_id].reviews.push({
        customer_name: rev.customer_name,
        rating: rev.rating,
        comment: rev.comment,
        review_date: rev.review_date
      })
    }
    
// 🧾 Step 8: Bookings (attach booking + room details)
for (const b of bookings) {
  const hotel = hotelMap[b.hotel_id];
  if (!hotel) continue;

  let existingBooking = hotel.bookings.find(
    (bk: any) => bk.booking_id === b.booking_id
  );

  if (!existingBooking) {
    existingBooking = {
      booking_id: b.booking_id,
      customer_name: b.customer_name,
      status: b.booking_status,
      total_amount: b.total_amount,
      cancel_reason: b.cancel_reasons || null,
      rooms: []
      
    };
    hotel.bookings.push(existingBooking);
  }

  // Add room details to that booking
  existingBooking.rooms.push({
    room_number: b.room_number,
    check_in: b.check_in,
    check_out: b.check_out,
    room_amount: b.room_amount,
  });
}
    
    //  Get total hotel count
    const [countResult] = await connection.query<any[]>(
      `SELECT COUNT(*) AS total FROM hotels`
    );

    //  Final response
    const responseData = {
      success: true,
      totalHotels: countResult[0].total,
      currentPage: page,
      totalPages: Math.ceil(countResult[0].total / limit),
      data: Object.values(hotelMap),
    };

    setCache(`hotels:page=${page}`, responseData, 300);
    return res.status(200).json(responseData);
  } catch (err: any) {
    if (connection) connection.release();
    console.error("❌ Error getting hotels:", err.message);
    next(err);
  } finally {
    if (connection) connection.release();
  }
};

// const filterHotelsByRoomsAvailability = async (req: Request, res: Response, next: NextFunction) => {
//   let connection;
//   try {
//     connection = await db.getConnection();

//     const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
//     const limit = 10;
//     const offset = (page - 1) * limit;
//     const sortHotelByRoomAvailability = (req.query.sortHotelByRoomAvailability as string)?.toLowerCase() || "";

//     const cacheKey = `hotels:sortByAvailability=${sortHotelByRoomAvailability}:page=${page}`;
//     const cached = getCache<any>(cacheKey);

//     if (cached) {
//       console.log("⚡ Cache hit:", cacheKey);
//       return res.status(200).json(cached);
//     }

//     console.log("🕵️ Cache miss:", cacheKey);

//     // 🔹 Step 1: Get paginated hotels
//     const [hotels] = await connection.query<any[]>(
//       `SELECT hotel_id, hotel_name, city, country, total_rooms, created_at
//        FROM hotels
//        ORDER BY created_at DESC
//        LIMIT ? OFFSET ?`,
//       [limit, offset]
//     );

//     if (hotels.length === 0) {
//       return res.status(200).json({
//         success: true,
//         data: [],
//         message: "No hotels found",
//       });
//     }

//     const hotelIds = hotels.map((h) => h.hotel_id);

//     // 🔹 Step 2: Get rooms and their availability
//     const [rooms] = await connection.query<any[]>(
//       `SELECT hotel_id, room_number, room_type, price_per_night, is_available
//        FROM rooms
//        WHERE hotel_id IN (?)`,
//       [hotelIds]
//     );
//     const availableRoomsCount: Record<string, number> = {};
//     for (const room of rooms) {
     
//       if( room.is_available) {
//         availableRoomsCount[room.hotel_id] =availableRoomsCount[room.hotel_id] || 0;
//       }
//     }
//     // 🔹 Step 3: Get services
//     const [services] = await connection.query<any[]>(
//       `SELECT hotel_id, service_id, service_name, service_charge
//        FROM services
//        WHERE hotel_id IN (?)`,
//       [hotelIds]
//     );


//     const [reviews]= await connection.query<any[]>(
//       `SELECT hotel_id, rating, 
//       comment,review_date, cust.customer_name
//       FROM reviews
//        LEFT JOIN(
//        SELECT customer_id, full_name AS customer_name
//        FROM customers
//        )AS cust ON reviews.customer_id = cust.customer_id
//        WHERE hotel_id IN (?)`,
//       [hotelIds]
//     );
// const [reviewSummary] = await connection.query<any[]>(
//   `SELECT hotel_id,
//           ROUND(AVG(rating), 2) AS avg_rating,
//           COUNT(*) AS total_reviews
//    FROM reviews
//    WHERE hotel_id IN (?)
//    GROUP BY hotel_id`,
//   [hotelIds]
// );

// // const [bookings] = await connection.query<any[]>(
// //   `SELECT hotel_id,COUNT(*) AS total_bookings FROM bookings WHERE hotel_id IN (?)
// //   AND booking_status NOT IN ('cancelled')
// //   GROUP BY hotel_id`,
// //   [hotelIds]
// // )

// // const totalBookings: Record<string, number> = {};
// // for(const book of bookings){
// //   totalBookings[book.hotel_id]= (totalBookings[book.hotel_id]||0) +1
// // }
// const [bookings] = await connection.query<any[]>(
//   `
//   SELECT 
//     b.booking_id, 
//     b.hotel_id, 
//     b.customer_id, 
//     b.total_amount, 
//     b.booking_status,
//     cust.full_name AS customer_name,
//     br.room_number, 
//     br.check_in, 
//     br.check_out, 
//     br.room_amount,
//     bc.cancel_reasons
//   FROM bookings b
//   LEFT JOIN customers cust ON b.customer_id = cust.customer_id
//   LEFT JOIN booking_rooms br ON b.booking_id = br.booking_id
//   LEFT JOIN bookings_cancelled bc ON b.booking_id = bc.booking_id
//   WHERE b.hotel_id IN (?)
//   ORDER BY b.created_at DESC
//   `,
//   [hotelIds]
// );
// const totalBookings: Record<string, number> = {};
// for (const b of bookings) {
//   if (b.booking_status !== "Cancelled") {
//     totalBookings[b.hotel_id] = (totalBookings[b.hotel_id] || 0) + 1;
//   }
// }
// // 🔹 Map average ratings for quick lookup
// const averageRatingOfHotels: Record<string, { avg_rating: number; total_reviews: number }> = {};
// for (const summary of reviewSummary) {
//   averageRatingOfHotels[summary.hotel_id] = {
//     avg_rating: summary.avg_rating,
//     total_reviews: summary.total_reviews,
//   };
// }
//     // 🔹 Step 4: Aggregate rooms & services by hotel
//     const hotelMap: Record<string, any> = {};

//     for (const hotel of hotels) {
//       hotelMap[hotel.hotel_id] = {
//         ...hotel,
//         total_rooms_available: availableRoomsCount[hotel.hotel_id] || 0, // ✅ computed
//                  average_rating: averageRatingOfHotels[hotel.hotel_id]?.avg_rating || 0,
//     total_reviews: averageRatingOfHotels[hotel.hotel_id]?.total_reviews || 0,
//     totalBookings: totalBookings[hotel.hotel_id] || 0,
//         rooms: [],
//         services: [],
//         reviews:[],
//         bookings:[]
//       };
//     }

//     // Aggregate rooms
//     for (const room of rooms) {
//       const h = hotelMap[room.hotel_id];
//       if (h) {
//         h.rooms.push({
//           room_number: room.room_number,
//           room_type: room.room_type,
//           price_per_night: room.price_per_night,
//           is_available: room.is_available,
//         });
//         if (room.is_available) h.total_rooms_available++;
//       }
//     }

//     // Aggregate services
//     for (const serv of services) {
//       const h = hotelMap[serv.hotel_id];
//       if (h) {
//         h.services.push({
//           service_id: serv.service_id,
//           service_name: serv.service_name,
//           service_charge: serv.service_charge,
//         });
//       }
//     }
//   for(const rev of reviews){
//       hotelMap[rev.hotel_id].reviews.push({
//         customer_name: rev.customer_name,
//         rating: rev.rating,
//         comment: rev.comment,
//         review_date: rev.review_date
//       })
//     }
//     // 🧾 Step 8: Bookings (attach booking + room details)
// for (const b of bookings) {
//   const hotel = hotelMap[b.hotel_id];
//   if (!hotel) continue;

//   let existingBooking = hotel.bookings.find(
//     (bk: any) => bk.booking_id === b.booking_id
//   );

//   if (!existingBooking) {
//     existingBooking = {
//       booking_id: b.booking_id,
//       customer_name: b.customer_name,
//       status: b.booking_status,
//       total_amount: b.total_amount,
//       cancel_reason: b.cancel_reasons || null,
//       rooms: []
      
//     };
//     hotel.bookings.push(existingBooking);
//   }

//   // Add room details to that booking
//   existingBooking.rooms.push({
//     room_number: b.room_number,
//     check_in: b.check_in,
//     check_out: b.check_out,
//     room_amount: b.room_amount,
//   });
// }
//     // 🔹 Step 5: Sort hotels by available rooms (in-memory)
//     let sortedHotels = Object.values(hotelMap);
//     if (sortHotelByRoomAvailability === "low to high") {
//       sortedHotels = sortedHotels.sort((a, b) => a.total_rooms_available - b.total_rooms_available);
//     } else if (sortHotelByRoomAvailability === "high to low") {
//       sortedHotels = sortedHotels.sort((a, b) => b.total_rooms_available - a.total_rooms_available);
//     }

//     // 🔹 Step 6: Get total count
//     const [countResult] = await connection.query<any[]>(`SELECT COUNT(*) AS total FROM hotels`);

//     const responseData = {
//       success: true,
//       totalHotels: countResult[0].total,
//       currentPage: page,
//       totalPages: Math.ceil(countResult[0].total / limit),
//       data: sortedHotels,
//     };

//     setCache(cacheKey, responseData, 300);
//     return res.status(200).json(responseData);

//   } catch (err: any) {
//      if (connection) connection.release();
//     console.error("❌ Error filtering hotels:", err.message);
//     next(err);
//   } finally {
//     if (connection) connection.release();
//   }
// };


// const filterHotelsByRatings = async (req: Request, res: Response, next: NextFunction) => {
//   let connection;
//   try {
//     connection = await db.getConnection();

//     const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
//     const limit = 10;
//     const offset = (page - 1) * limit;
//     const ratings = (req.query.ratings as string)?.toLowerCase() || "";

//     const cacheKey = `hotels:sortByRating=${ratings}:page=${page}`;
//     const cached = getCache<any>(cacheKey);

//     if (cached) {
//       console.log("⚡ Cache hit:", cacheKey);
//       return res.status(200).json(cached);
//     }

//     console.log("🕵️ Cache miss:", cacheKey);

//     // 🔹 Step 1: Get paginated hotels
//     const [hotels] = await connection.query<any[]>(
//       `SELECT hotel_id, hotel_name, city, country, total_rooms, created_at
//        FROM hotels
//        ORDER BY created_at DESC
//        LIMIT ? OFFSET ?`,
//       [limit, offset]
//     );

//     if (hotels.length === 0) {
//       return res.status(200).json({
//         success: true,
//         data: [],
//         message: "No hotels found",
//       });
//     }

//     const hotelIds = hotels.map((h) => h.hotel_id);

//     // 🔹 Step 2: Get rooms and their availability
//     const [rooms] = await connection.query<any[]>(
//       `SELECT hotel_id, room_number, room_type, price_per_night, is_available
//        FROM rooms
//        WHERE hotel_id IN (?)`,
//       [hotelIds]
//     );
//     const availableRoomsCount: Record<string, number> = {};
//     for (const room of rooms) {
//       if (room.is_available) {
//         availableRoomsCount[room.hotel_id] =availableRoomsCount[room.hotel_id] || 0;
//       }
//     }
//     // 🔹 Step 3: Get services
//     const [services] = await connection.query<any[]>(
//       `SELECT hotel_id, service_id, service_name, service_charge
//        FROM services
//        WHERE hotel_id IN (?)`,
//       [hotelIds]
//     );


//     const [reviews]= await connection.query<any[]>(
//       `SELECT hotel_id, rating, 
//       comment,review_date, cust.customer_name
//       FROM reviews
//        LEFT JOIN(
//        SELECT customer_id, full_name AS customer_name
//        FROM customers
//        )AS cust ON reviews.customer_id = cust.customer_id
//        WHERE hotel_id IN (?)`,
//       [hotelIds]
//     );
// const [reviewSummary] = await connection.query<any[]>(
//   `SELECT hotel_id,
//           ROUND(AVG(rating), 2) AS avg_rating,
//           COUNT(*) AS total_reviews
//    FROM reviews
//    WHERE hotel_id IN (?)
//    GROUP BY hotel_id`,
//   [hotelIds]
// );

// const [bookings] = await connection.query<any[]>(
//   `
//   SELECT 
//     b.booking_id, 
//     b.hotel_id, 
//     b.customer_id, 
//     b.total_amount, 
//     b.booking_status,
//     cust.full_name AS customer_name,
//     br.room_number, 
//     br.check_in, 
//     br.check_out, 
//     br.room_amount,
//     bc.cancel_reasons
//   FROM bookings b
//   LEFT JOIN customers cust ON b.customer_id = cust.customer_id
//   LEFT JOIN booking_rooms br ON b.booking_id = br.booking_id
//   LEFT JOIN bookings_cancelled bc ON b.booking_id = bc.booking_id
//   WHERE b.hotel_id IN (?)
//   ORDER BY b.created_at DESC
//   `,
//   [hotelIds]
// );
// const totalBookings: Record<string, number> = {};
// for (const b of bookings) {
//   if (b.booking_status !== "Cancelled") {
//     totalBookings[b.hotel_id] = (totalBookings[b.hotel_id] || 0) + 1;
//   }
// }

// // 🔹 Map average ratings for quick lookup
// const averageRatingOfHotels: Record<string, { avg_rating: number; total_reviews: number }> = {};
// for (const summary of reviewSummary) {
//   averageRatingOfHotels[summary.hotel_id] = {
//     avg_rating: summary.avg_rating,
//     total_reviews: summary.total_reviews,
//   };
// }
//     // 🔹 Step 4: Aggregate rooms & services by hotel
//     const hotelMap: Record<string, any> = {};

//     for (const hotel of hotels) {
//       hotelMap[hotel.hotel_id] = {
//         ...hotel,
//         total_rooms_available: availableRoomsCount[hotel.hotel_id] || 0, // ✅ computed
//                  average_rating: averageRatingOfHotels[hotel.hotel_id]?.avg_rating || 0,
//     total_reviews: averageRatingOfHotels[hotel.hotel_id]?.total_reviews || 0,
//     totalBookings: totalBookings[hotel.hotel_id] || 0,
//         rooms: [],
//         services: [],
//         reviews:[],
//         bookings:[]
//       };
//     }

//     // Aggregate rooms
//     for (const room of rooms) {
//       const h = hotelMap[room.hotel_id];
//       if (h) {
//         h.rooms.push({
//           room_number: room.room_number,
//           room_type: room.room_type,
//           price_per_night: room.price_per_night,
//           is_available: room.is_available,
//         });
//         if (room.is_available) h.total_rooms_available++;
//       }
//     }

//     // Aggregate services
//     for (const serv of services) {
//       const h = hotelMap[serv.hotel_id];
//       if (h) {
//         h.services.push({
//           service_id: serv.service_id,
//           service_name: serv.service_name,
//           service_charge: serv.service_charge,
//         });
//       }
//     }
//   for(const rev of reviews){
//       hotelMap[rev.hotel_id].reviews.push({
//         customer_name: rev.customer_name,
//         rating: rev.rating,
//         comment: rev.comment,
//         review_date: rev.review_date
//       })
//     }
//     // 🧾 Step 8: Bookings (attach booking + room details)
// for (const b of bookings) {
//   const hotel = hotelMap[b.hotel_id];
//   if (!hotel) continue;

//   let existingBooking = hotel.bookings.find(
//     (bk: any) => bk.booking_id === b.booking_id
//   );

//   if (!existingBooking) {
//     existingBooking = {
//       booking_id: b.booking_id,
//       customer_name: b.customer_name,
//       status: b.booking_status,
//       total_amount: b.total_amount,
//       cancel_reason: b.cancel_reasons || null,
//       rooms: []
      
//     };
//     hotel.bookings.push(existingBooking);
//   }

//   // Add room details to that booking
//   existingBooking.rooms.push({
//     room_number: b.room_number,
//     check_in: b.check_in,
//     check_out: b.check_out,
//     room_amount: b.room_amount,
//   });
// }
//     // 🔹 Step 5: Sort hotels by available rooms (in-memory)
//     let sortedHotels = Object.values(hotelMap);
//     if (ratings === "low to high") {
//       sortedHotels = sortedHotels.sort((a, b) => a.average_rating - b.average_rating);
//     } else if (ratings === "high to low") {
//       sortedHotels = sortedHotels.sort((a, b) => b.average_rating - a.average_rating);
//     }

//     // 🔹 Step 6: Get total count
//     const [countResult] = await connection.query<any[]>(`SELECT COUNT(*) AS total FROM hotels`);

//     const responseData = {
//       success: true,
//       totalHotels: countResult[0].total,
//       currentPage: page,
//       totalPages: Math.ceil(countResult[0].total / limit),
//       data: sortedHotels,
//     };

//     setCache(cacheKey, responseData, 300);
//     return res.status(200).json(responseData);

//   } catch (err: any) {
//      if (connection) connection.release();
//     console.error("❌ Error filtering hotels:", err.message);
//     next(err);
//   } finally {
//     if (connection) connection.release();
//   }
// };

const filterHotels = async (req: Request, res: Response, next: NextFunction) => {
  let connection;
  try{
    connection = await db.getConnection();
    
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const limit = 10;
    const offset = (page - 1) * limit;
    //const sortHotelByRoomAvailability = (req.query.sortHotelByRoomAvailability as string)?.toLowerCase() || "";
    const searchCity = (req.query.city as string)?.toLowerCase() || "";
    const country = (req.query.country as string)?.toLowerCase() || "";
   const ratings = req.query.ratings ? parseFloat(req.query.ratings as string) : 0;
const sortHotelByRoomAvailability = (req.query.sortHotelByRoomAvailability as string)?.toLowerCase() || "";
const bookingsCount = (req.query.bookingsCount as string)?.toLowerCase() || "";
    const cacheKey = `hotels:searchCity=${searchCity}:
    country=${country}:sortByAvailability=${sortHotelByRoomAvailability}
    :sortByRating=${ratings}: bookingsCount=${bookingsCount}:page=${page}`;
    const cached = getCache<any>(cacheKey);

    if (cached) {
      console.log("⚡ Cache hit:", cacheKey);
      return res.status(200).json(cached);
    }

    console.log("🕵️ Cache miss:", cacheKey);

    // 🔹 Step 1: Get paginated hotels
    const [hotels] = await connection.query<any[]>(
      `SELECT hotel_id, hotel_name, city, country, total_rooms, created_at
       FROM hotels
       
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [ limit, offset]
    )
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
      `SELECT hotel_id, room_number, room_type, price_per_night, is_available
       FROM rooms
       WHERE hotel_id IN (?)`,
      [hotelIds]
    );
    const availableRoomsCount: Record<string, number> = {};
    for (const room of rooms) {
      if (room.is_available) {
        availableRoomsCount[room.hotel_id] =availableRoomsCount[room.hotel_id] || 0;
      }
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

const [bookings] = await connection.query<any[]>(
  `
  SELECT 
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
    bc.cancel_reasons
  FROM bookings b
  LEFT JOIN customers cust ON b.customer_id = cust.customer_id
  LEFT JOIN booking_rooms br ON b.booking_id = br.booking_id
  LEFT JOIN bookings_cancelled bc ON b.booking_id = bc.booking_id
  WHERE b.hotel_id IN (?)
  ORDER BY b.created_at DESC
  `,
  [hotelIds]
);
const totalBookings: Record<string, number> = {};
for (const b of bookings) {
  if (b.booking_status !== "Cancelled") {
    totalBookings[b.hotel_id] = (totalBookings[b.hotel_id] || 0) + 1;
  }
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
    totalBookings: totalBookings[hotel.hotel_id] || 0,
        rooms: [],
        services: [],
        reviews:[],
        bookings:[]
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
    // 🧾 Step 8: Bookings (attach booking + room details)
for (const b of bookings) {
  const hotel = hotelMap[b.hotel_id];
  if (!hotel) continue;

  let existingBooking = hotel.bookings.find(
    (bk: any) => bk.booking_id === b.booking_id
  );

  if (!existingBooking) {
    existingBooking = {
      booking_id: b.booking_id,
      customer_name: b.customer_name,
      status: b.booking_status,
      total_amount: b.total_amount,
      cancel_reason: b.cancel_reasons || null,
      rooms: []
      
    };
    hotel.bookings.push(existingBooking);
  }

  // Add room details to that booking
  existingBooking.rooms.push({
    room_number: b.room_number,
    check_in: b.check_in,
    check_out: b.check_out,
    room_amount: b.room_amount,
  });
}
    // 🔹 Step 5: Sort hotels by available rooms (in-memory)
    let sortedHotels = Object.values(hotelMap);
    // if (searchCity === "low to high") {
    //   sortedHotels = sortedHotels.sort((a, b) => a.total_rooms_available - b.total_rooms_available);
    // } else if (searchCity === "high to low") {
    //   sortedHotels = sortedHotels.sort((a, b) => b.total_rooms_available - a.total_rooms_available);
    // }
if (searchCity) {
  sortedHotels = sortedHotels.filter(hotel =>
    hotel.city.toLowerCase().includes(searchCity)
  );
}
if (country) {
  sortedHotels = sortedHotels.filter(hotel =>
    hotel.country.toLowerCase().includes(country)
  );
}
    if(ratings){
      sortedHotels = sortedHotels.filter(h=>
        h.average_rating >= ratings
      )
    }
    if (sortHotelByRoomAvailability === "low to high") {
      sortedHotels = sortedHotels.sort((a, b) =>
         a.total_rooms_available - b.total_rooms_available);
    } else if (sortHotelByRoomAvailability === "high to low") {
      sortedHotels = sortedHotels.sort((a, b) => b.total_rooms_available - a.total_rooms_available);
    }
      if (bookingsCount === "low to high") {
      sortedHotels = sortedHotels.sort((a, b) => a.total_bookings - b.total_bookings);
    } else if (bookingsCount ==="high to low") {
      sortedHotels = sortedHotels.sort((a, b) => b.total_bookings - a.total_bookings);
    }
    // 🔹 Step 6: Get total count
    //const [countResult] = await connection.query<any[]>(`SELECT COUNT(*) AS total FROM hotels`);
    const filteredHotels = sortedHotels;
const totalHotels = filteredHotels.length;
const totalPages = Math.ceil(totalHotels / limit);

// Slice only the current page items (optional)
const paginatedHotels = filteredHotels.slice((page - 1) * limit, page * limit);

    const responseData = {
      success: true,
      totalHotels: totalHotels,
      currentPage: page,
      totalPages: totalPages,
      data: paginatedHotels,
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

// const filterHotelsByBookingCount = async (req: Request, res: Response, next: NextFunction) => {
//  let connection;
//   try{
//     connection = await db.getConnection();
    
//     const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
//     const limit = 10;
//     const offset = (page - 1) * limit;
//     //const sortHotelByRoomAvailability = (req.query.sortHotelByRoomAvailability as string)?.toLowerCase() || "";
// const bookingsCount = (req.query.bookingsCount as string)?.toLowerCase() || "";
//     const cacheKey = `hotels:bookingsCount=${bookingsCount}:page=${page}`;
//     const cached = getCache<any>(cacheKey);

//     if (cached) {
//       console.log("⚡ Cache hit:", cacheKey);
//       return res.status(200).json(cached);
//     }

//     console.log("🕵️ Cache miss:", cacheKey);

//     // 🔹 Step 1: Get paginated hotels
//     const [hotels] = await connection.query<any[]>(
//       `SELECT hotel_id, hotel_name, city, country, total_rooms, created_at
//        FROM hotels
//        ORDER BY created_at DESC
//        LIMIT ? OFFSET ?`,
//       [limit, offset]
//     );

//     if (hotels.length === 0) {
//       return res.status(200).json({
//         success: true,
//         data: [],
//         message: "No hotels found",
//       });
//     }

//     const hotelIds = hotels.map((h) => h.hotel_id);

//     // 🔹 Step 2: Get rooms and their availability
//     const [rooms] = await connection.query<any[]>(
//       `SELECT hotel_id, room_number, room_type, price_per_night, is_available
//        FROM rooms
//        WHERE hotel_id IN (?)`,
//       [hotelIds]
//     );
//     const availableRoomsCount: Record<string, number> = {};
//     for (const room of rooms) {
//       if (room.is_available) {
//         availableRoomsCount[room.hotel_id] =availableRoomsCount[room.hotel_id] || 0;
//       }
//     }
//     // 🔹 Step 3: Get services
//     const [services] = await connection.query<any[]>(
//       `SELECT hotel_id, service_id, service_name, service_charge
//        FROM services
//        WHERE hotel_id IN (?)`,
//       [hotelIds]
//     );


//     const [reviews]= await connection.query<any[]>(
//       `SELECT hotel_id, rating, 
//       comment,review_date, cust.customer_name
//       FROM reviews
//        LEFT JOIN(
//        SELECT customer_id, full_name AS customer_name
//        FROM customers
//        )AS cust ON reviews.customer_id = cust.customer_id
//        WHERE hotel_id IN (?)`,
//       [hotelIds]
//     );
// const [reviewSummary] = await connection.query<any[]>(
//   `SELECT hotel_id,
//           ROUND(AVG(rating), 2) AS avg_rating,
//           COUNT(*) AS total_reviews
//    FROM reviews
//    WHERE hotel_id IN (?)
//    GROUP BY hotel_id`,
//   [hotelIds]
// );

// const [bookings] = await connection.query<any[]>(
//   `
//   SELECT 
//     b.booking_id, 
//     b.hotel_id, 
//     b.customer_id, 
//     b.total_amount, 
//     b.booking_status,
//     cust.full_name AS customer_name,
//     br.room_number, 
//     br.check_in, 
//     br.check_out, 
//     br.room_amount,
//     bc.cancel_reasons
//   FROM bookings b
//   LEFT JOIN customers cust ON b.customer_id = cust.customer_id
//   LEFT JOIN booking_rooms br ON b.booking_id = br.booking_id
//   LEFT JOIN bookings_cancelled bc ON b.booking_id = bc.booking_id
//   WHERE b.hotel_id IN (?)
//   ORDER BY b.created_at DESC
//   `,
//   [hotelIds]
// );
// const totalBookings: Record<string, number> = {};
// for (const b of bookings) {
//   if (b.booking_status !== "Cancelled") {
//     totalBookings[b.hotel_id] = (totalBookings[b.hotel_id] || 0) + 1;
//   }
// }


// // 🔹 Map average ratings for quick lookup
// const averageRatingOfHotels: Record<string, { avg_rating: number; total_reviews: number }> = {};
// for (const summary of reviewSummary) {
//   averageRatingOfHotels[summary.hotel_id] = {
//     avg_rating: summary.avg_rating,
//     total_reviews: summary.total_reviews,
//   };
// }
//     // 🔹 Step 4: Aggregate rooms & services by hotel
//     const hotelMap: Record<string, any> = {};

//     for (const hotel of hotels) {
//       hotelMap[hotel.hotel_id] = {
//         ...hotel,
//         total_rooms_available: availableRoomsCount[hotel.hotel_id] || 0, // ✅ computed
//                  average_rating: averageRatingOfHotels[hotel.hotel_id]?.avg_rating || 0,
//     total_reviews: averageRatingOfHotels[hotel.hotel_id]?.total_reviews || 0,
//     totalBookings: totalBookings[hotel.hotel_id] || 0,
//         rooms: [],
//         services: [],
//         reviews:[],
//         bookings:[]
//       };
//     }

//     // Aggregate rooms
//     for (const room of rooms) {
//       const h = hotelMap[room.hotel_id];
//       if (h) {
//         h.rooms.push({
//           room_number: room.room_number,
//           room_type: room.room_type,
//           price_per_night: room.price_per_night,
//           is_available: room.is_available,
//         });
//         if (room.is_available) h.total_rooms_available++;
//       }
//     }

//     // Aggregate services
//     for (const serv of services) {
//       const h = hotelMap[serv.hotel_id];
//       if (h) {
//         h.services.push({
//           service_id: serv.service_id,
//           service_name: serv.service_name,
//           service_charge: serv.service_charge,
//         });
//       }
//     }
//   for(const rev of reviews){
//       hotelMap[rev.hotel_id].reviews.push({
//         customer_name: rev.customer_name,
//         rating: rev.rating,
//         comment: rev.comment,
//         review_date: rev.review_date
//       })
//     }
//     // 🧾 Step 8: Bookings (attach booking + room details)
// for (const b of bookings) {
//   const hotel = hotelMap[b.hotel_id];
//   if (!hotel) continue;

//   let existingBooking = hotel.bookings.find(
//     (bk: any) => bk.booking_id === b.booking_id
//   );

//   if (!existingBooking) {
//     existingBooking = {
//       booking_id: b.booking_id,
//       customer_name: b.customer_name,
//       status: b.booking_status,
//       total_amount: b.total_amount,
//       cancel_reason: b.cancel_reasons || null,
//       rooms: []
      
//     };
//     hotel.bookings.push(existingBooking);
//   }

//   // Add room details to that booking
//   existingBooking.rooms.push({
//     room_number: b.room_number,
//     check_in: b.check_in,
//     check_out: b.check_out,
//     room_amount: b.room_amount,
//   });
// }
//     // 🔹 Step 5: Sort hotels by available rooms (in-memory)
//     let sortedHotels = Object.values(hotelMap);
//     if (bookingsCount === "low to high") {
//       sortedHotels = sortedHotels.sort((a, b) => a.total_bookings - b.total_bookings);
//     } else if (bookingsCount === "high to low") {
//       sortedHotels = sortedHotels.sort((a, b) => b.total_bookings - a.total_bookings);
//     }

//     // 🔹 Step 6: Get total count
//     const [countResult] = await connection.query<any[]>(`SELECT 
//       COUNT(*) AS total FROM hotels`);

//     const responseData = {
//       success: true,
//       totalHotels: countResult[0].total,
//       currentPage: page,
//       totalPages: Math.ceil(countResult[0].total / limit),
//       data: sortedHotels,
//     };

//     setCache(cacheKey, responseData, 300);
//     return res.status(200).json(responseData);

//   } catch (err: any) {
//      if (connection) connection.release();
//     console.error("❌ Error filtering hotels:", err.message);
//     next(err);
//   } finally {
//     if (connection) connection.release();
  
//   }
// }


export { addHotel, updateHotel, 
  getAllHotelsWithRooms,
  // filterHotelsByRoomsAvailability,
filterHotels
};