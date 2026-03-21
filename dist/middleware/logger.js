"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestLogger = void 0;
const requestLogger = (req, _res, next) => {
    const now = new Date().toISOString();
    console.info(`[${now}] ${req.method} ${req.originalUrl}`);
    next();
};
exports.requestLogger = requestLogger;
