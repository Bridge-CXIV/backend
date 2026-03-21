"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = exports.authenticate = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const apiError_1 = require("./apiError");
const jwtSecret = process.env.JWT_SECRET ?? "changeme";
if (!process.env.JWT_SECRET) {
    console.warn("JWT_SECRET is not set; falling back to a default secret (development only)");
}
/**
 * Optionally attaches the user to req.user if a valid Bearer token is present.
 * Does NOT reject unauthenticated requests — use `requireAuth` for that.
 */
const authenticate = (req, _res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return next();
    }
    const [scheme, token] = authHeader.split(" ");
    if (scheme !== "Bearer" || !token) {
        return next(new apiError_1.ApiError(401, "Malformed authorization header"));
    }
    try {
        const payload = jsonwebtoken_1.default.verify(token, jwtSecret);
        req.user = payload;
        next();
    }
    catch (error) {
        next(new apiError_1.ApiError(401, "Invalid or expired token"));
    }
};
exports.authenticate = authenticate;
/**
 * Requires that the request has been authenticated.
 * Use after `authenticate` in the middleware chain.
 */
const requireAuth = (req, _res, next) => {
    if (!req.user) {
        return next(new apiError_1.ApiError(401, "Authentication required"));
    }
    next();
};
exports.requireAuth = requireAuth;
