import type { NextFunction, Request, Response } from "express";

export const requestLogger = (req: Request, _res: Response, next: NextFunction) => {
  const now = new Date().toISOString();
  console.info(`[${now}] ${req.method} ${req.originalUrl}`);
  next();
};
