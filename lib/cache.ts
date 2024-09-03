// lib/cache.ts
import redisClient from './redisClient';

export const getFromCache = async (key: string): Promise<string | null> => {
  try {
    const reply = await redisClient.get(key);
    return reply;
  } catch (err) {
    console.error('Error fetching from cache', err);
    return null;
  }
};

export const setToCache = async (key: string, value: string, expiry: number): Promise<void> => {
  try {
    await redisClient.setEx(key, expiry, value);
  } catch (err) {
    console.error('Error setting cache', err);
  }
};
