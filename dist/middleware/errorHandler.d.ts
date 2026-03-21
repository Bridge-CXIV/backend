import type { NextFunction, Request, Response } from "express";
import { ApiError } from "./apiError.js";
export declare const errorHandler: (err: Error | ApiError, req: Request, res: Response, next: NextFunction) => void;
//# sourceMappingURL=errorHandler.d.ts.map