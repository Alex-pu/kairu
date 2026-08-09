import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message });
  }
  // Turn request-validation failures into a clean 400 instead of a generic 500.
  if (err instanceof ZodError) {
    const message = err.errors.map((e) => `${e.path.join('.') || 'body'}: ${e.message}`).join('; ');
    return res.status(400).json({ error: message, details: err.errors });
  }
  console.error(err);
  return res.status(500).json({ error: 'Internal server error' });
}
