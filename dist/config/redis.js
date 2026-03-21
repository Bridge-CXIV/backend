"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const redis_1 = require("redis");
const redisUrl = process.env.REDIS_URL ?? "redis://127.0.0.1:6380";
const client = (0, redis_1.createClient)({ url: redisUrl });
client.on("error", (error) => {
    console.error("Redis client error:", error.message);
});
exports.default = client;
