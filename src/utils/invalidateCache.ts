import { clearCacheByPrefix } from "./cache";

type Entity = "hotels" | "customer"|"review"|"booking"|"maintenance";

/**
 * Clears relevant cache entries for given entity type.
 * This avoids stale data after CREATE/UPDATE/DELETE operations.
 */
export const invalidateCacheFor = (entity: Entity): void => {
  switch (entity) {
    case "hotels":
      clearCacheByPrefix("hotels:");
      break;
    // case "order":
    //   clearCacheByPrefix("orders:");
    //   clearCacheByPrefix("products:"); // stock might change
    //   break;
    // case "category":
    //   clearCacheByPrefix("categories:");
      
    //   break;
    case "customer":
      clearCacheByPrefix("customers:");
      clearCacheByPrefix("orders:");
      break;

      case "booking":
      clearCacheByPrefix("booking:");
      break;

      case "review":
      clearCacheByPrefix("reviews:");
      break;

      case "maintenance":
      clearCacheByPrefix("maintenance:");
      break;
    default:
      console.warn(`⚠️ Unknown entity type for cache invalidation: ${entity}`);
  }
};
