import redisClient from "../config/redis";

const DEFAULT_TTL_SECONDS = 60 * 5;

export const getCachedValue = async (key: string) => {
  return redisClient.get(key);
};

export const setCachedValue = async (
  key: string,
  value: string,
  ttlSeconds = DEFAULT_TTL_SECONDS,
) => {
  if (ttlSeconds > 0) {
    await redisClient.set(key, value, {
      EX: ttlSeconds,
    });
    return;
  }

  await redisClient.set(key, value);
};

export const deleteCachedValue = async (key: string) => {
  await redisClient.del(key);
};
