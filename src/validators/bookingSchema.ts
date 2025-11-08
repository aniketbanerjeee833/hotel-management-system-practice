import { z } from "zod";

// ✅ Helper function (as you wrote)
const digitsOnly = (fieldName: string, required = true) =>
  z.union([z.string(), z.number()])
    .refine(
      (val) => {
        const strVal = String(val);
        if (!strVal) return !required;
        return /^\d+(\.\d{1,2})?$/.test(strVal);
      },
      { message: `${fieldName} is required and should be a number` }
    )
    .transform((val) => Number(val));

// ✅ Booking Schema
export const bookingSchema = z.object({
  booking_id: z.string().trim().optional(), // generated in backend

  customer_id: z.string().trim().min(1, "Customer ID is required").max(20),
  hotel_id: z.string().trim().min(1, "Hotel ID is required").max(20),

  total_amount: digitsOnly("Total amount", true),

  booking_status: z
    .enum(["Confirmed", "Cancelled", "Completed"])
    .default("Confirmed"),
 

  booking_rooms: z
    .array(
      z
        .object({
          booking_room_id: z.string().trim().optional(),
            room_number: z
            .string()
            .trim()
            .min(1, "Room number is required")
            .max(20, "Room number too long"),
          check_in: z
            .string()
            .trim()
            .refine((val) => !isNaN(Date.parse(val)), "Invalid check-in date"),
          check_out: z
            .string()
            .trim()
            .refine((val) => !isNaN(Date.parse(val)), "Invalid check-out date"),
            
          room_amount: digitsOnly("Room amount", true),
        })
        .refine(
          (data) => new Date(data.check_out) > new Date(data.check_in),
          {
            message: "Check-out date must be after check-in date",
            path: ["check_out"],
          }
        )
    )
    .nonempty("At least one room set is required"),
});


export type Booking = z.infer<typeof bookingSchema>;
