// import { NextFunction, Request, Response } from "express";
// import db from "../../config/db";
// import { setCache } from "../../utils/cache";

// const getAllHotelsWithRooms = async (req: Request, res: Response, next: NextFunction) => {
//   let connection;
//   try {
//     connection = await db.getConnection();

//     const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
//     const limit = 10;
//     const offset = (page - 1) * limit;

//     // ✅ 1️⃣ Fetch paginated hotels
//     const [hotels] = await connection.query<any[]>(
//       `SELECT hotel_id, hotel_name, city, country, total_rooms, created_at
//        FROM hotels
//        ORDER BY created_at DESC
//        LIMIT ? OFFSET ?`,
//       [limit, offset]
//     );

//     const hotelIds = hotels.map((h) => h.hotel_id);

//     if (hotelIds.length === 0) {
//       return res.status(200).json({
//         success: true,
//         data: [],
//         message: "No hotels found",
//       });
//     }

//     // ✅ 2️⃣ Fetch rooms (with availability count per hotel)
//     const [rooms] = await connection.query<any[]>(
//       `SELECT 
//           r.hotel_id,
//           r.room_number,
//           r.room_type,
//           r.price_per_night,
//           r.is_available
//        FROM rooms r
//        WHERE r.hotel_id IN (?)`,
//       [hotelIds]
//     );

//     // ✅ Aggregate available rooms by hotel_id
//     const availableRoomsCount: Record<string, number> = {};
//     for (const room of rooms) {
//       if (room.is_available) {
//         availableRoomsCount[room.hotel_id] =
//           (availableRoomsCount[room.hotel_id] || 0) + 1;
//       }
//     }

//     // ✅ 3️⃣ Fetch services
//     const [services] = await connection.query<any[]>(
//       `SELECT hotel_id, service_id, service_name, service_charge
//        FROM services
//        WHERE hotel_id IN (?)`,
//       [hotelIds]
//     );

//     // ✅ 4️⃣ Combine everything
//     const hotelMap: Record<string, any> = {};

//     for (const hotel of hotels) {
//       hotelMap[hotel.hotel_id] = {
//         ...hotel,
//         total_rooms_available: availableRoomsCount[hotel.hotel_id] || 0, // ✅ computed
//         rooms: [],
//         services: [],
//       };
//     }

//     for (const room of rooms) {
//       hotelMap[room.hotel_id].rooms.push({
//         room_number: room.room_number,
//         room_type: room.room_type,
//         price_per_night: room.price_per_night,
//         is_available: room.is_available,
//       });
//     }

//     for (const serv of services) {
//       hotelMap[serv.hotel_id].services.push({
//         service_id: serv.service_id,
//         service_name: serv.service_name,
//         service_charge: serv.service_charge,
//       });
//     }

//     // ✅ 5️⃣ Get total hotel count
//     const [countResult] = await connection.query<any[]>(
//       `SELECT COUNT(*) AS total FROM hotels`
//     );

//     // ✅ 6️⃣ Final response
//     const responseData = {
//       success: true,
//       totalHotels: countResult[0].total,
//       currentPage: page,
//       totalPages: Math.ceil(countResult[0].total / limit),
//       data: Object.values(hotelMap),
//     };

//     setCache(`hotels:page=${page}`, responseData, 300);
//     return res.status(200).json(responseData);
//   } catch (err: any) {
//     console.error("❌ Error getting hotels:", err.message);
//     next(err);
//   } finally {
//     if (connection) connection.release();
//   }
// };

