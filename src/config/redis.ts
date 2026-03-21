import "dotenv/config";
import { createClient } from "redis";

const redisUrl = process.env.REDIS_URL ?? "redis://127.0.0.1:6380";

const client = createClient({ url: redisUrl });

client.on("error", (error) => {
  console.error("Redis client error:", error.message);
});

export default client;
