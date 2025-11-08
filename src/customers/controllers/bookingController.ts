import { NextFunction, Request, Response } from "express";
import db from "../../config/db";
import { sanitizeObject } from "../../utils/sanitizeInput";
import { bookingSchema } from "../../validators/bookingSchema";
import { invalidateCacheFor } from "../../utils/invalidateCache";
import { cancelBookingSchema } from "../../validators/cancelBookingSchema";

const addBooking = async (req: Request, res: Response, next: NextFunction) => {
  let connection;

  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    const cleanData = sanitizeObject(req.body);
    const parsed = bookingSchema.safeParse(cleanData);

    if (!parsed.success) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        errors: parsed.error.issues.map((e) => e.message),
      });
    }

    const {
      customer_id,
      hotel_id,
      total_amount,
      booking_status,
      booking_rooms,
    } = parsed.data;

    const[totalRooms] = await connection.query<any[]>(
      `SELECT total_rooms FROM hotels WHERE hotel_id = ?`,
      [hotel_id]
    )
    if(totalRooms[0].total_rooms < booking_rooms.length){
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: "Not enough rooms available"
      });
    }
    // ✅ Generate booking_id
    const [lastBooking] = await connection.query<any[]>(
      `SELECT booking_id FROM bookings ORDER BY CAST(SUBSTRING(booking_id, 5) AS UNSIGNED) DESC LIMIT 1`
    );
    const nextNum =
      lastBooking.length > 0
        ? Number(lastBooking[0].booking_id.replace(/\D/g, "")) + 1
        : 1;
    const bookingId = "BOOK" + nextNum.toString().padStart(5, "0");

    // ✅ Insert into bookings table
    await connection.execute(
      `INSERT INTO bookings (booking_id, customer_id, hotel_id, booking_status, total_amount)
       VALUES (?, ?, ?, ?, ?)`,
      [bookingId, customer_id, hotel_id, booking_status, total_amount]
    );

    // ✅ Handle each booking_rooms entry
 
for (const booking of booking_rooms) {
      const { room_number, check_in, check_out } = booking;

      // --- Check if room exists and belongs to this hotel
      const [rooms] = await connection.query<any[]>(
        `SELECT room_number, is_available, price_per_night 
         FROM rooms 
         WHERE room_number = ? AND hotel_id = ?`,
        [room_number, hotel_id]
      );
      
         if (rooms.length === 0) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          message: `Room ${room_number} not found in hotel ${hotel_id}`,
        });
      }

   

      if (!rooms[0].is_available) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          message: `Room ${room_number} is already booked.`,
        });
      }

      // --- Generate booking_room_id
      const [lastBookingRoom] = await connection.query<any[]>(
        `SELECT booking_room_id FROM booking_rooms ORDER BY CAST(SUBSTRING(booking_room_id, 3) AS UNSIGNED) DESC LIMIT 1`
      );

      let nextBookingRoomNum = 1;
      if (lastBookingRoom.length > 0) {
        nextBookingRoomNum =
          Number(lastBookingRoom[0].booking_room_id.replace(/\D/g, "")) + 1;
      }

      const bookingRoomId =
        "BR" + nextBookingRoomNum.toString().padStart(5, "0");

      // --- Insert booking room record
   await connection.execute(
  `INSERT INTO booking_rooms (booking_room_id, booking_id, room_number, check_in, check_out, room_amount)
   VALUES (?, ?, ?, ?, ?, ?)`,
  [
    bookingRoomId,
    bookingId,
    room_number,
    check_in,
    check_out,
    Number(rooms[0].price_per_night),
  ]
);


      // --- Mark room unavailable
      await connection.execute(
        `UPDATE rooms SET is_available = FALSE WHERE room_number = ? AND hotel_id = ?`,
        [room_number, hotel_id]
      );
    }

    await connection.commit();
    invalidateCacheFor("booking");

    
    return res.status(201).json({
      success: true,
      message: "Booking created successfully",
      booking_id: bookingId,
      booked_rooms: booking_rooms.map((r) => r.room_number),
    });
  } catch (err: any) {
    if (connection) await connection.rollback();
    console.error("❌ Error adding booking:", err?.message || err);
    next(err);
  } finally {
    if (connection) connection.release();
  }
};
const cancelWholeBooking = async (req: Request, res: Response, next: NextFunction) => {
  let connection;
  try {
    const { booking_id } = req.params;

    connection = await db.getConnection();
    await connection.beginTransaction();

    const cleanData = sanitizeObject(req.body);
    const validation = cancelBookingSchema.safeParse(cleanData);

    if (!validation.success) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        errors: validation.error.issues.map((e) => e.message),
      });
    }

    const { hotel_id, customer_id, cancel_reason } = validation.data;

    // 🔹 Validate hotel
    const [hotel] = await connection.query<any[]>(
      `SELECT hotel_id FROM hotels WHERE hotel_id = ?`,
      [hotel_id]
    );
    if (hotel.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: "Hotel not found, cannot cancel",
      });
    }

    // 🔹 Check if booking exists
    const [bookings] = await connection.query<any[]>(
      `SELECT * FROM bookings WHERE booking_id = ?`,
      [booking_id]
    );
    if (bookings.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: "Booking not found, cannot cancel",
      });
    }

    const booking = bookings[0];

    // 🔹 Check if booking belongs to the same customer
    if (booking.customer_id !== customer_id) {
      await connection.rollback();
      return res.status(403).json({
        success: false,
        message: "You are not authorized to cancel this booking",
      });
    }

    // 🔹 Cancel the booking
    await connection.execute(
      `UPDATE bookings SET booking_status = 'Cancelled',updated_at=NOW() WHERE booking_id = ?`,
      [booking_id]
    );

    // ✅ Generate booking_cancel_id
    const [lastCancel] = await connection.query<any[]>(
      `SELECT booking_cancel_id FROM bookings_cancelled 
       ORDER BY CAST(SUBSTRING(booking_cancel_id, 11) AS UNSIGNED) DESC LIMIT 1`
    );

    let nextNum = 1;
    if (lastCancel.length > 0) {
      nextNum = Number(lastCancel[0].booking_cancel_id.replace(/\D/g, "")) + 1;
    }

    const bookingCancelId = "BOOKCANCEL" + nextNum.toString().padStart(5, "0");

    // ✅ Insert cancel record
    await connection.execute(
      `INSERT INTO bookings_cancelled 
        (booking_cancel_id, booking_id, customer_id, hotel_id, total_amount, cancel_reasons)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        bookingCancelId,
        booking_id,
        customer_id,
        hotel_id,
        booking.total_amount,
        cancel_reason,
      ]
    );

    // ✅ Optional: make rooms available again
    await connection.execute(
      `UPDATE rooms 
       SET is_available=TRUE 
       WHERE room_number IN (
         SELECT room_number FROM booking_rooms WHERE booking_id = ?
       )`,
      [booking_id]
    );

    await connection.commit();
    invalidateCacheFor("booking");

    return res.status(200).json({
      success: true,
      message: "Booking cancelled successfully",
      booking_cancel_id: bookingCancelId,
    });

  } catch (err: any) {
    if (connection) await connection.rollback();
    console.error("❌ Error cancelling booking:", err.message);
    next(err);
  } finally {
    if (connection) connection.release();
  }
};


export {addBooking, cancelWholeBooking};