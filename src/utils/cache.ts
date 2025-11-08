import NodeCache from "node-cache";

const cache = new NodeCache({
  stdTTL: 300, // default cache time: 5 minutes
  checkperiod: 60, // cleanup every minute
});

// ✅ Type-safe cache functions
export const getCache = <T>(key: string): T | undefined => cache.get<T>(key);

export const setCache = (key: string, data: any, ttl?: any): void => {
  cache.set(key, data, ttl);
};

export const clearCacheByPrefix = (prefix: string): void => {
  const keys = cache.keys().filter((key) => key.startsWith(prefix));
  keys.forEach((key) => cache.del(key));
  if (keys.length > 0) {
    console.log(`🧹 Cleared ${keys.length} cache entries for prefix: ${prefix}`);
  }
};

export const clearAllCache = (): void => {
  cache.flushAll();
  console.log("🧨 Cleared all cache entries!");
};

export default cache;
