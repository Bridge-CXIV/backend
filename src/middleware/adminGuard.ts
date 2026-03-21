import type { NextFunction, RequestHandler, Response } from "express";
import { ApiError } from "./apiError";

/**
 * Requires that the authenticated user has the ADMIN role.
 * Must be used after `authenticate` and `requireAuth` in the middleware chain.
 */
export const requireAdmin: RequestHandler = (req, _res: Response, next: NextFunction) => {
  if (!req.user || req.user.role !== "ADMIN") {
    return next(new ApiError(403, "Admin privileges are required"));
  }

  next();
};
