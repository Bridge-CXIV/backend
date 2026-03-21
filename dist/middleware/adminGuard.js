"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAdmin = void 0;
const apiError_1 = require("./apiError");
/**
 * Requires that the authenticated user has the ADMIN role.
 * Must be used after `authenticate` and `requireAuth` in the middleware chain.
 */
const requireAdmin = (req, _res, next) => {
    if (!req.user || req.user.role !== "ADMIN") {
        return next(new apiError_1.ApiError(403, "Admin privileges are required"));
    }
    next();
};
exports.requireAdmin = requireAdmin;
