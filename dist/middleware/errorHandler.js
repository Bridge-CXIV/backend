"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = void 0;
const apiError_1 = require("./apiError");
const errorHandler = (err, req, res, next) => {
    const status = err instanceof apiError_1.ApiError ? err.statusCode : 500;
    console.error(err);
    res.status(status).json({
        error: err.message || "Internal server error",
    });
};
exports.errorHandler = errorHandler;
