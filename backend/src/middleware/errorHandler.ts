import { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";
import { logger } from "../utils/logger";

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ error: "NOT_FOUND", message: "Resource not found." });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  const referenceId = `ERR-${new Date().getFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`;

  if (err instanceof ApiError) {
    logger.warn("handled_api_error", { referenceId, code: err.code, path: req.path, message: err.message });
    return res.status(err.status).json({ error: err.code, message: err.message, referenceId });
  }

  logger.error("unhandled_error", { referenceId, path: req.path, message: err?.message, stack: err?.stack });

  const status = err?.status && Number.isInteger(err.status) ? err.status : 500;
  res.status(status).json({
    error: "INTERNAL_ERROR",
    message: "Ticketing service is temporarily unavailable. Please try again later.",
    referenceId,
  });
}
