
import { z } from "zod";

export const cancelBookingSchema = z.object({
  booking_cancel_id: z
    .string()
    .trim()
    .max(20, "Booking Cancel ID too long")
    .optional(),

  booking_id: z
    .string()
    .trim()
    .max(20, "Booking ID too long")
    .optional(),

  customer_id: z
    .string()
    .trim()
    .min(1, "Customer ID is required")
    .max(20, "Customer ID too long"),

  hotel_id: z
    .string()
    .trim()
    .min(1, "Hotel ID is required")
    .max(20, "Hotel ID too long"),

  cancel_reason: z
    .string()
    .trim()
    .min(5, "Cancel reason must be at least 5 characters long")
    .max(1000, "Cancel reason too long"),
});

export type CancelBookingSchema = z.infer<typeof cancelBookingSchema>;
