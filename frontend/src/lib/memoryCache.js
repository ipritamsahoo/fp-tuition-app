// In-memory cache for API responses (clears on app reload/close)
const memoryCache = new Map();

/**
 * Get data from memory cache
 * @param {string} key 
 * @returns {any} Returns the cached data or undefined
 */
export const getCache = (key) => memoryCache.get(key);

/**
 * Set data to memory cache
 * @param {string} key 
 * @param {any} value 
 */
export const setCache = (key, value) => {
    memoryCache.set(key, value);
};

/**
 * Clear specific key or whole cache
 * @param {string} [key] Optional key to clear. If omitted, clears all.
 */
export const clearCache = (key) => {
    if (key) {
        memoryCache.delete(key);
    } else {
        memoryCache.clear();
    }
};
