import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";



/**
 * Global Error Handler Middleware
 * Handles MySQL, Zod, JWT, and general application errors gracefully.
 */
const isProduction=false
export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  console.error("🔥 Global Error:", err);

  let statusCode: number = err.status || 500;
  let message: string = err.message || "Internal Server Error";

  // 🧩 Handle MySQL-specific errors
  if (err.code) {
    switch (err.code) {
      case "ER_DUP_ENTRY":
        statusCode = 409;
        message = "Duplicate entry detected. Please use unique values.";
        break;

      case "ER_BAD_FIELD_ERROR":
        statusCode = 400;
        message = "Invalid field in database query.";
        break;

      case "ER_PARSE_ERROR":
        statusCode = 500;
        message = "Database query parse error.";
        break;

      case "PROTOCOL_CONNECTION_LOST":
        statusCode = 503;
        message = "Database connection lost. Please retry.";
        break;

      case "ECONNREFUSED":
        statusCode = 503;
        message = "Database connection refused.";
        break;

      case "ER_TRUNCATED_WRONG_VALUE_FOR_FIELD":
        statusCode = 400;
        message = "Invalid date or value provided for a field.";
        break;

      default:
        message = `Database Error: ${err.code}`;
        break;
    }
  }

  // 🧩 Handle Zod validation errors
 if (err instanceof ZodError) {
    statusCode = 400;
    message = err.issues.map((i) => i.message).join(", ");
  }

  // 🧩 Handle Unauthorized access
  if (err.name === "UnauthorizedError") {
    statusCode = 401;
    message = "Unauthorized access.";
  }

  // 🧩 Handle expired or invalid JWT
  if (err.name === "TokenExpiredError") {
    statusCode = 401;
    message = "Session expired. Please log in again.";
  }

  // 🧩 Catch all unknown errors
  if (statusCode === 500 && err.stack) {
    console.error("Stack Trace:", err.stack);
  }

  // ✅ Ensure status code is valid
  if (!statusCode || statusCode < 400 || statusCode >= 600) {
    statusCode = 500;
  }

  // 🧩 Send clean error response
  res.status(statusCode).json({
    success: false,
    message,
    ...(isProduction ? {} : { stack: err.stack }),
  });
};

export default errorHandler;
