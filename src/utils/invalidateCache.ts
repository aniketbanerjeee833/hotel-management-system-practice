import { clearCacheByPrefix } from "./cache";

type Entity = "hotels" | "customers"|"review"|"booking"|"maintenance";

/**
 * Clears relevant cache entries for given entity type.
 * This avoids stale data after CREATE/UPDATE/DELETE operations.
 */
export const invalidateCacheFor = (entity: Entity): void => {
  switch (entity) {
    case "hotels":
      clearCacheByPrefix("hotels:");
       clearCacheByPrefix("customers-hotels:"); // ✅ customer-facing hotel list
      break;
    // case "order":
    //   clearCacheByPrefix("orders:");
    //   clearCacheByPrefix("products:"); // stock might change
    //   break;
    // case "category":
    //   clearCacheByPrefix("categories:");
      
    //   break;
    case "customers":
      clearCacheByPrefix("customers:");
      clearCacheByPrefix("orders:");
      break;

      // case "booking":
      // clearCacheByPrefix("booking:");
      // break;

      // case "review":
      // clearCacheByPrefix("reviews:");
      // break;

      // case "maintenance":
      // clearCacheByPrefix("maintenance:");
      case "booking":
      clearCacheByPrefix("booking:");
      clearCacheByPrefix("bookings:");
      clearCacheByPrefix("customers-hotels:"); // ✅ bookings affect availability
      break;

    case "review":
      clearCacheByPrefix("reviews:");
      clearCacheByPrefix("customers-hotels:"); // ✅ reviews affect hotel rating
      break;

    case "maintenance":
      clearCacheByPrefix("maintenance:");
      clearCacheByPrefix("customers-hotels:"); // ✅ maintenance affects availability
      break;
    default:
      console.warn(`⚠️ Unknown entity type for cache invalidation: ${entity}`);
  }
};
