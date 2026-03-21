import type { NextFunction, Request, Response } from "express";
import { ApiError } from "./apiError";

export const errorHandler = (err: Error | ApiError, req: Request, res: Response, next: NextFunction) => {
  const status = err instanceof ApiError ? err.statusCode : 500;
  console.error(err);
  res.status(status).json({
    error: err.message || "Internal server error",
  });
};
