import { NextFunction, Request, Response } from 'express';
import { AppError } from './errorHandler';
import { TokenRole, verifyToken } from '@/utils/jwt';

declare global {
  namespace Express {
    interface Request {
      user?: { id: string; email: string; role: TokenRole };
    }
  }
}

export function requireAuth(role: TokenRole) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new AppError('Not authenticated', 401);
    }

    try {
      const payload = verifyToken(header.replace('Bearer ', ''));
      if (payload.role !== role) throw new AppError('Not authorized', 403);
      req.user = { id: payload.sub, email: payload.email, role: payload.role };
      next();
    } catch {
      throw new AppError('Invalid or expired token', 401);
    }
  };
}