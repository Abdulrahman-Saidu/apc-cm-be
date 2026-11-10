import { NextFunction, Request, Response } from 'express';
import { ZodTypeAny } from 'zod';
import { AppError } from './errorHandler';

export function validateBody(schema: ZodTypeAny) {
  return (req: Request, _res: Response, next: NextFunction) => {
    req.body = schema.parse(req.body);
    next();
  };
}

export function validateQuery(schema: ZodTypeAny) {
  return (req: Request, _res: Response, next: NextFunction) => {
    req.query = schema.parse(req.query) as any;
    next();
  };
}

// Ids are opaque strings from the database. Only obvious garbage is rejected
// here; a well-formed id that doesn't exist is answered with 404 by the service.
const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

/** Rejects a malformed :id up front (400) instead of sending it to the database. */
export function validateIdParam(name = 'id') {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!ID_PATTERN.test(String(req.params[name] ?? ''))) {
      throw new AppError('Invalid id', 400);
    }
    next();
  };
}
