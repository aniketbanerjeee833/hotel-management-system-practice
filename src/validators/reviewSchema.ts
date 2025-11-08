import { z } from "zod";

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
export const reviewSchema = z.object({
  review_id: z.string().trim().optional(), // backend-generated (REV00001)

  hotel_id:z.string().trim().min(1, "Hotel ID is required").max(20),
  customer_id: z.string().trim().min(1, "Customer ID is required").max(20),

  rating: digitsOnly("Rating", true)
    .refine((val) => val >= 1 && val <= 5, {
      message: "Rating must be between 1 and 5",
    }),

  comment: z.string().trim().max(1000, "Comment too long").optional(),

});

export type Review = z.infer<typeof reviewSchema>;
