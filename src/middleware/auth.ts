import type { NextFunction, RequestHandler, Response } from "express";
import jwt from "jsonwebtoken";
import { ApiError } from "./apiError";

const jwtSecret = process.env.JWT_SECRET ?? "changeme";

if (!process.env.JWT_SECRET) {
  console.warn("JWT_SECRET is not set; falling back to a default secret (development only)");
}

/**
 * Optionally attaches the user to req.user if a valid Bearer token is present.
 * Does NOT reject unauthenticated requests — use `requireAuth` for that.
 */
export const authenticate: RequestHandler = (req, _res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return next();
  }

  const [scheme, token] = authHeader.split(" ");

  if (scheme !== "Bearer" || !token) {
    return next(new ApiError(401, "Malformed authorization header"));
  }

  try {
    const payload = jwt.verify(token, jwtSecret) as Express.AuthPayload;
    req.user = payload;
    next();
  } catch (error) {
    next(new ApiError(401, "Invalid or expired token"));
  }
};

/**
 * Requires that the request has been authenticated.
 * Use after `authenticate` in the middleware chain.
 */
export const requireAuth: RequestHandler = (req, _res: Response, next: NextFunction) => {
  if (!req.user) {
    return next(new ApiError(401, "Authentication required"));
  }
  next();
};
