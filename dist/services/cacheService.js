"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteCachedValue = exports.setCachedValue = exports.getCachedValue = void 0;
const redis_1 = __importDefault(require("../config/redis"));
const DEFAULT_TTL_SECONDS = 60 * 5;
const getCachedValue = async (key) => {
    return redis_1.default.get(key);
};
exports.getCachedValue = getCachedValue;
const setCachedValue = async (key, value, ttlSeconds = DEFAULT_TTL_SECONDS) => {
    if (ttlSeconds > 0) {
        await redis_1.default.set(key, value, {
            EX: ttlSeconds,
        });
        return;
    }
    await redis_1.default.set(key, value);
};
exports.setCachedValue = setCachedValue;
const deleteCachedValue = async (key) => {
    await redis_1.default.del(key);
};
exports.deleteCachedValue = deleteCachedValue;
