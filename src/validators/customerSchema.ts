// CREATE TABLE customers (
//     id INT PRIMARY KEY AUTO_INCREMENT,
//     customer_id VARCHAR(20) UNIQUE NOT NULL,
//     full_name VARCHAR(255) NOT NULL,
//     email VARCHAR(255) UNIQUE,
//     phone VARCHAR(20),
//     city VARCHAR(100),
//     country VARCHAR(100),
//     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
//     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
// );

import { z } from "zod";
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
export const customerSchema = z.object({
    full_name: z
        .string()
        .min(1, "Full name is required")
        .max(255, "Full name must be less than 255 characters"),
    email: z
        .string()
        .email("Invalid email address")
        .min(1, "Email is required")
        .max(255, "Email must be less than 255 characters"),
    phone: z
        .string()
        .min(1, "Phone number is required")
        .max(20, "Phone number must be less than 20 characters"),
    city: z
        .string()
        .min(1, "City is required")
        .max(100, "City must be less than 100 characters"),
    country: z
        .string()
        .min(1, "Country is required")
        .max(100, "Country must be less than 100 characters"),
});
export type Customer = z.infer<typeof customerSchema>;