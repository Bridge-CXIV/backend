import winston from "winston";
import path from "path";

// Custom format for console with colors
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.printf((info) => {
    const { level, message, ...meta } = info;
    const timestamp =
      typeof info.timestamp === "string" ? info.timestamp : new Date().toISOString();

    let msg = `${timestamp} [${level}]: ${String(message)}`;
    if (Object.keys(meta).length > 0) {
      msg += ` ${JSON.stringify(meta)}`;
    }
    return msg;
  })
);

// Format for files (JSON for easy parsing)
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Determine log level from environment
const logLevel = process.env.LOG_LEVEL || "info";

// Base transports (always active)
const transports: winston.transport[] = [
  // Console output with colors
  new winston.transports.Console({
    format: consoleFormat,
  }),

  // All logs
  new winston.transports.File({
    filename: path.join("logs", "combined.log"),
    maxsize: 10485760, // 10MB
    maxFiles: 5,
  }),

  // Error logs
  new winston.transports.File({
    filename: path.join("logs", "error.log"),
    level: "error",
    maxsize: 10485760, // 10MB
    maxFiles: 5,
  }),

  // Info logs (for important events)
  new winston.transports.File({
    filename: path.join("logs", "info.log"),
    level: "info",
    maxsize: 10485760, // 10MB
    maxFiles: 5,
  }),
];

export const logger = winston.createLogger({
  level: logLevel,
  format: fileFormat,
  defaultMeta: { 
    service: "glassgive-api",
    environment: process.env.NODE_ENV || "development",
  },
  transports,
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join("logs", "exceptions.log"),
    }),
  ],
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join("logs", "rejections.log"),
    }),
  ],
});

// If not in production, log to console with more detail
if (process.env.NODE_ENV !== "production") {
  logger.level = "debug";
}
