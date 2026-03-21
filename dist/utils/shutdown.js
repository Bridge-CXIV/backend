"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.gracefulShutdown = void 0;
const db_1 = __importDefault(require("../config/db"));
const logger_1 = require("../config/logger");
// Handle graceful shutdown
const gracefulShutdown = async () => {
    try {
        await db_1.default.$disconnect();
        logger_1.logger.info("Database connection closed gracefully");
    }
    catch (err) {
        logger_1.logger.error("Error closing database connection", err);
    }
    // Force exit after cleanup
    logger_1.logger.info("Graceful shutdown complete");
    process.exit(0);
};
exports.gracefulShutdown = gracefulShutdown;
