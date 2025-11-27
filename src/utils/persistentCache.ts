/**
 * Persistent Cache Utility
 *
 * Stores cache data in AsyncStorage to survive app restarts.
 * This significantly improves cold start performance by showing cached data immediately
 * while fresh data is being fetched in the background.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_PREFIX = '@customer_cache_';
const CACHE_VERSION = '1.0'; // Increment to invalidate old cache

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  version: string;
}

/**
 * Save data to persistent cache
 */
export async function saveToPersistentCache<T>(
  key: string,
  data: T,
): Promise<void> {
  try {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      version: CACHE_VERSION,
    };
    await AsyncStorage.setItem(`${CACHE_PREFIX}${key}`, JSON.stringify(entry));
  } catch (error) {
    console.warn('Failed to save to persistent cache:', error);
  }
}

/**
 * Load data from persistent cache
 * Returns null if cache is expired, invalid, or doesn't exist
 */
export async function loadFromPersistentCache<T>(
  key: string,
  maxAge: number = 24 * 60 * 60 * 1000, // Default: 24 hours
): Promise<T | null> {
  try {
    const cached = await AsyncStorage.getItem(`${CACHE_PREFIX}${key}`);
    if (!cached) return null;

    const entry: CacheEntry<T> = JSON.parse(cached);

    // Check version compatibility
    if (entry.version !== CACHE_VERSION) {
      console.log('Cache version mismatch, clearing old cache');
      await clearPersistentCache(key);
      return null;
    }

    // Check if cache is expired
    const age = Date.now() - entry.timestamp;
    if (age > maxAge) {
      console.log('Cache expired, clearing');
      await clearPersistentCache(key);
      return null;
    }

    return entry.data;
  } catch (error) {
    console.warn('Failed to load from persistent cache:', error);
    return null;
  }
}

/**
 * Clear persistent cache for a specific key
 */
export async function clearPersistentCache(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(`${CACHE_PREFIX}${key}`);
  } catch (error) {
    console.warn('Failed to clear persistent cache:', error);
  }
}

/**
 * Clear all persistent cache
 */
export async function clearAllPersistentCache(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const cacheKeys = keys.filter(key => key.startsWith(CACHE_PREFIX));
    await AsyncStorage.multiRemove(cacheKeys);
  } catch (error) {
    console.warn('Failed to clear all persistent cache:', error);
  }
}
