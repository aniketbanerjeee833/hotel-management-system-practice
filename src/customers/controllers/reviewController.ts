import { Request, Response, NextFunction } from "express";
import db from "../../config/db"; // adjust path to your DB connection
import { sanitizeObject } from "../../utils/sanitizeInput";
import { reviewSchema } from "../../validators/reviewSchema";
import { invalidateCacheFor } from "../../utils/invalidateCache";


 const addReview = async (req: Request, res: Response, next: NextFunction) => {
  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    const cleanData = sanitizeObject(req.body);
    const validation = reviewSchema.safeParse(cleanData);

    if (!validation.success) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        errors: validation.error.issues.map((e) => e.message),
      });
    }

    const { hotel_id, customer_id, rating, comment} = validation.data;

    const [hotel] = await connection.query<any[]>(
      `SELECT * FROM hotels WHERE hotel_id = ?`,
      [hotel_id]
    );

    if (hotel.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: "Hotel not found",
      });
    }

    const [customer] = await connection.query<any[]>(
      `SELECT * FROM customers WHERE customer_id = ?`,
      [customer_id]
    );

    if (customer.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }
    
    // ✅ Generate unique review_id
    const [lastReview] = await connection.query<any[]>(
      `SELECT review_id FROM reviews ORDER BY CAST(SUBSTRING(review_id, 4) AS UNSIGNED) DESC LIMIT 1`
    );

    let nextNum = 1;
    if (lastReview.length > 0) {
      nextNum = Number(lastReview[0].review_id.replace(/\D/g, "")) + 1;
    }

    const reviewId = "REV" + nextNum.toString().padStart(5, "0");

    // ✅ Insert new review
    await connection.execute(
      `INSERT INTO reviews 
       (review_id, hotel_id, customer_id, rating, comment, review_date, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, CURDATE(), NOW(), NOW())`,
      [reviewId, hotel_id, customer_id, rating, comment || null]
    );

    await connection.commit();
    invalidateCacheFor("review");
    return res.status(201).json({
      success: true,
      message: "Review added successfully",
      review_id: reviewId,
    });
  } catch (err: any) {
    if (connection) await connection.rollback();
    console.error("❌ Error adding review:", err.message);
    next(err);
  } finally {
    if (connection) connection.release();
  }
};
export { addReview };