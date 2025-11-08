import { z } from "zod";

/**
 * 🔹 Schema for adding new maintenance records
 * Used in: addMaintenance controller
 */
export const maintenanceSchema = z.object({
  maintenance: z
    .array(
      z.object({
        maintenance_id: z
          .string()
          .trim()
          .max(20, "Maintenance ID too long")
          .optional(),

        room_number: z
          .string()
          .trim()
          .min(1, "Room number is required")
          .max(20, "Room number too long"),

        issue_description: z
          .string()
          .trim()
          .min(5, "Issue description must be at least 5 characters long")
          .max(1000, "Issue description too long"),

        maintenance_date: z
          .string()
          .trim()
          .refine(
            (val) => !isNaN(Date.parse(val)),
            "Invalid maintenance date"
          ),

        maintenance_status: z
          .enum(["Pending", "Completed", "Cancelled"])
          .default("Pending"),
      })
    )
    .nonempty("At least one maintenance record is required"),
});

/**
 * 🔹 Schema for editing an existing maintenance record
 * Used in: updateMaintenance controller
 */
export const maintenanceEditSchema = z.object({
  room_number: z
    .string()
    .trim()
    .min(1, "Room number is required")
    .max(20, "Room number too long"),

  maintenance_status: z
    .enum(["Pending", "Completed", "Cancelled"])
    .default("Pending"),
});

// 🔹 Export Types
export type MaintenanceSchema = z.infer<typeof maintenanceSchema>;
export type MaintenanceEditSchema = z.infer<typeof maintenanceEditSchema>;
