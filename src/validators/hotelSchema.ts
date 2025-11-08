import { z } from "zod";

// ✅ Reusable number validator for integer-only fields

const digitsOnly = (fieldName:any, required = true) =>
  z
    .union([z.string(), z.number()])  // allow both
    .refine(
      (val) => {
        const strVal = String(val);
        if (!strVal) return !required;
        return /^\d+(\.\d{1,2})?$/.test(strVal);
      },
      { message: `${fieldName} is required and should be a number` }
    )
    .transform((val) => Number(val)); // ✅ always store as number
export const hotelSchema = z.object({
  hotel_name: z
    .string()
    .min(1, "Hotel name is required")
    .max(100, "Hotel name must be less than 100 characters"),

  city: z
    .string()
    .min(1, "City is required")
    .max(100, "City must be less than 100 characters"),

  country: z
    .string()
    .min(1, "Country is required")
    .max(100, "Country must be less than 100 characters"),



  total_rooms: digitsOnly("Total rooms", true),

  rooms: z.array(z.object({
    room_number: z.string().min(1, "Room number is required").max(10, "Room number must be less than 10 characters"),
      room_type: z.enum(["Deluxe", "Suite", "Standard"]),
      price_per_night: digitsOnly("Price per night", true),
      is_available: z.boolean().default(true),
    })
  ),
 services: z.array(z.object({
    service_id: z.string().optional(), // ✅ optional for new entries
    service_name: z.string().optional().transform((val) => val?.trim() || ""),
          service_charge: z.union([z.string(), z.number(), z.null(), z.undefined()]).optional().transform((val) => (val ? Number(val) : null)),
        })
        .refine(
          (data) =>
            !data.service_name || // if service_name is empty, ignore
            (data.service_name && data.service_charge !== null && !isNaN(data.service_charge)),
          {
            message: "If service name is provided, service charge must be a valid number",
            path: ["service_charge"],
          }
        )
    )
    .optional(),
});

export type Hotel = z.infer<typeof hotelSchema>;