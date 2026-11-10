import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { logger } from '@/utils/logger';

export class AppError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
  }
}

/** Errors raised by express.json() for bad request bodies. */
function bodyParserStatus(err: unknown): number | null {
  const type = (err as { type?: string } | null)?.type;
  if (type === 'entity.parse.failed') return 400;
  if (type === 'entity.too.large') return 413;
  return null;
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    logger.warn('Validation failed', { path: req.path, method: req.method });
    return res.status(422).json({
      message: 'Validation failed',
      errors: err.errors.map((e) => ({ path: e.path.join('.'), message: e.message })),
    });
  }

  const parserStatus = bodyParserStatus(err);
  if (parserStatus) {
    logger.warn('Bad request body', { path: req.path, method: req.method, statusCode: parserStatus });
    return res.status(parserStatus).json({
      message: parserStatus === 413 ? 'Request is too large.' : 'Request body is not valid JSON.',
    });
  }

  if (err instanceof AppError) {
    // 4xx are expected/handled outcomes (bad input, not found, etc.) — log as warn, not error.
    // 5xx are unexpected failures worth flagging louder.
    const level = err.statusCode >= 500 ? 'error' : 'warn';
    logger[level](err.message, { path: req.path, method: req.method, statusCode: err.statusCode });
    return res.status(err.statusCode).json({ message: err.message });
  }

  const message = err instanceof Error ? err.message : 'Unknown error';
  const stack = err instanceof Error ? err.stack : undefined;
  logger.error('Unhandled error', { path: req.path, method: req.method, message, stack });

  return res.status(500).json({ message: 'Something went wrong. Please try again.' });
}

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ message: 'Route not found' });
}

/** Postgres "invalid input syntax" (e.g. an id in the wrong format): treat as not found. */
export function isInvalidIdError(error: { code?: string } | null | undefined): boolean {
  return error?.code === '22P02';
}
