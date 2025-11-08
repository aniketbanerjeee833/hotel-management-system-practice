import e, { NextFunction, Request, Response } from "express";
import db from "../../config/db";
import { sanitizeObject } from "../../utils/sanitizeInput";
import { maintenanceSchema } from "../../validators/maintenanceSchema";
import { invalidateCacheFor } from "../../utils/invalidateCache";
import { maintenanceEditSchema } from "../../validators/maintenanceSchema";

const addMaintenance = async (req: Request, res: Response, next: NextFunction) => {
  let connection;

  try {
   const { hotel_id, employee_id } = req.params; // ✅ from URL params
    connection = await db.getConnection();
    await connection.beginTransaction();

    const [employees] = await connection.query<any[]>(
      `SELECT employee_id,role FROM employees WHERE employee_id = ?`,
      [employee_id]
    )

    if (employees.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }
    if(employees[0].role !== "employee"){
        await connection.rollback();
        return res.status(404).json({
          success: false,
          message: "You are not authorized to add maintenance records",
        });
        
    }
    const cleanData = sanitizeObject(req.body);
    const validation = maintenanceSchema.safeParse(cleanData);

    if (!validation.success) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        errors: validation.error.issues.map((e) => e.message),
      });
    }

    const { maintenance } = validation.data;

    // 🔹 Validate hotel
    const [hotel] = await connection.query<any[]>(
      `SELECT hotel_id FROM hotels WHERE hotel_id = ?`,
      [hotel_id]
    );
    if (hotel.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: "Hotel not found",
      });
    }

    for (const maintenanceItem of maintenance) {
      const {
       
        room_number,
      
        issue_description,
        maintenance_date,
        maintenance_status,
      } = maintenanceItem;

      // ✅ Validate Room and Hotel
      const [room] = await connection.query<any[]>(
        `SELECT room_number FROM rooms WHERE room_number = ? AND hotel_id = ?`,
        [room_number, hotel_id]
      );

      if (room.length === 0) {
        await connection.rollback();
        return res.status(404).json({
          success: false,
          message: `Room ${room_number} not found in hotel ${hotel_id}`,
        });
      }

      // ✅ Generate Unique Maintenance ID
      const [lastMaintenance] = await connection.query<any[]>(
        `SELECT maintenance_id 
         FROM maintenance 
         ORDER BY CAST(SUBSTRING(maintenance_id, 9) AS UNSIGNED) DESC 
         LIMIT 1`
      );

      let nextNum = 1;
      if (lastMaintenance.length > 0) {
        nextNum = Number(lastMaintenance[0].maintenance_id.replace(/\D/g, "")) + 1;
      }

      const maintenanceId = "MAINTAIN" + nextNum.toString().padStart(5, "0");

      // ✅ Insert maintenance record
      await connection.execute(
        `INSERT INTO maintenance 
          (maintenance_id, hotel_id, room_number, employee_id, issue_description, maintenance_date, maintenance_status)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          maintenanceId,
          hotel_id,
          room_number,
          employee_id,
          issue_description,
          maintenance_date,
          maintenance_status,
        ]
      );
    }

    await connection.commit();
    invalidateCacheFor("maintenance");

    return res.status(201).json({
      success: true,
      message: "Maintenance record(s) added successfully",
    });

  } catch (err: any) {
    if (connection) await connection.rollback();
    console.error("❌ Error adding maintenance:", err.message);
    next(err);
  } finally {
    if (connection) connection.release();
  }
};

const updateMaintenance = async (req: Request, res: Response, next: NextFunction) => {
  let connection;

  try {
    const { hotel_id, employee_id, maintenance_id } = req.params; 
    connection = await db.getConnection();
    await connection.beginTransaction();

    // ✅ Validate employee
    const [employees] = await connection.query<any[]>(
      `SELECT employee_id, role FROM employees WHERE employee_id = ?`,
      [employee_id]
    );

    if (employees.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    if (employees[0].role !== "employee") {
      await connection.rollback();
      return res.status(403).json({
        success: false,
        message: "You are not authorized to update maintenance records",
      });
    }

    // ✅ Validate request body
    const cleanData = sanitizeObject(req.body);
    const validation = maintenanceEditSchema.safeParse(cleanData);

    if (!validation.success) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        errors: validation.error.issues.map((e) => e.message),
      });
    }

    const { room_number, maintenance_status } = validation.data;

    // ✅ Validate hotel
    const [hotel] = await connection.query<any[]>(
      `SELECT hotel_id FROM hotels WHERE hotel_id = ?`,
      [hotel_id]
    );
    if (hotel.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: "Hotel not found",
      });
    }

    // ✅ Validate room in this hotel
    const [room] = await connection.query<any[]>(
      `SELECT room_number FROM rooms WHERE room_number = ? AND hotel_id = ?`,
      [room_number, hotel_id]
    );

    if (room.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: `Room ${room_number} not found in hotel ${hotel_id}`,
      });
    }

    const [maintenance] = await connection.query<any[]>(
      `SELECT maintenance_status 
       FROM maintenance 
       WHERE maintenance_id = ? AND hotel_id = ? AND room_number = ?`,
      [maintenance_id, hotel_id, room_number]
    )
    if (maintenance.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: "Maintenance record not found",
      });
    }

    if (maintenance[0].maintenance_status === maintenance_status) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: "Maintenance status is already updated",
      });
    }
    // ✅ Update maintenance
    const [result] = await connection.execute(
      `UPDATE maintenance 
       SET maintenance_status = ?, updated_at = NOW() 
       WHERE maintenance_id = ? AND hotel_id = ? AND room_number = ?`,
      [maintenance_status, maintenance_id, hotel_id, room_number]
    );

    if ((result as any).affectedRows === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: "Maintenance record not found or already updated",
      });
    }

    await connection.commit();
    invalidateCacheFor("maintenance");

    return res.status(200).json({
      success: true,
      message: "Maintenance status updated successfully",
      maintenance_id,
      updated_status: maintenance_status,
    });

  } catch (err: any) {
    if (connection) await connection.rollback();
    console.error("❌ Error updating maintenance:", err.message);
    next(err);
  } finally {
    if (connection) connection.release();
  }
};




export { addMaintenance, updateMaintenance };