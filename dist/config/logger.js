"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
const winston_1 = __importDefault(require("winston"));
const path_1 = __importDefault(require("path"));
// Custom format for console with colors
const consoleFormat = winston_1.default.format.combine(winston_1.default.format.colorize(), winston_1.default.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }), winston_1.default.format.printf(({ timestamp, level, message, ...meta }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0) {
        msg += ` ${JSON.stringify(meta)}`;
    }
    return msg;
}));
// Format for files (JSON for easy parsing)
const fileFormat = winston_1.default.format.combine(winston_1.default.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }), winston_1.default.format.errors({ stack: true }), winston_1.default.format.json());
// Determine log level from environment
const logLevel = process.env.LOG_LEVEL || "info";
// Base transports (always active)
const transports = [
    // Console output with colors
    new winston_1.default.transports.Console({
        format: consoleFormat,
    }),
    // All logs
    new winston_1.default.transports.File({
        filename: path_1.default.join("logs", "combined.log"),
        maxsize: 10485760, // 10MB
        maxFiles: 5,
    }),
    // Error logs
    new winston_1.default.transports.File({
        filename: path_1.default.join("logs", "error.log"),
        level: "error",
        maxsize: 10485760, // 10MB
        maxFiles: 5,
    }),
    // Info logs (for important events)
    new winston_1.default.transports.File({
        filename: path_1.default.join("logs", "info.log"),
        level: "info",
        maxsize: 10485760, // 10MB
        maxFiles: 5,
    }),
];
exports.logger = winston_1.default.createLogger({
    level: logLevel,
    format: fileFormat,
    defaultMeta: {
        service: "glassgive-api",
        environment: process.env.NODE_ENV || "development",
    },
    transports,
    exceptionHandlers: [
        new winston_1.default.transports.File({
            filename: path_1.default.join("logs", "exceptions.log"),
        }),
    ],
    rejectionHandlers: [
        new winston_1.default.transports.File({
            filename: path_1.default.join("logs", "rejections.log"),
        }),
    ],
});
// If not in production, log to console with more detail
if (process.env.NODE_ENV !== "production") {
    exports.logger.level = "debug";
}
