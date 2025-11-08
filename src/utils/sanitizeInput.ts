import createDOMPurify from "dompurify";
import { JSDOM } from "jsdom";

const window = new JSDOM("").window;
const DOMPurify = createDOMPurify(window);

/** Sanitize a single string */
export const sanitize = (value: string): string =>
  DOMPurify.sanitize(value).trim();

/** Recursively sanitize all string fields in an object or array */
export const sanitizeObject = <T>(obj: T): T => {
  if (Array.isArray(obj)) {
    // ✅ preserve array structure
    return obj.map((item) => sanitizeObject(item)) as T;
  }

  if (obj !== null && typeof obj === "object") {
    const sanitized: Record<string, any> = {};
    for (const key in obj) {
      const val = obj[key];
      if (typeof val === "string") {
        sanitized[key] = sanitize(val);
      } else if (val !== null && typeof val === "object") {
        sanitized[key] = sanitizeObject(val);
      } else {
        sanitized[key] = val;
      }
    }
    return sanitized as T;
  }

  // primitive value
  return obj;
};
