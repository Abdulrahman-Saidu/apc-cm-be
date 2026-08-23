import { NextFunction, Request, Response } from 'express';
import { AppError } from './errorHandler';
import { env } from '@/config/env';

export function requireSuperAdmin(req: Request, _res: Response, next: NextFunction) {
  if (req.user?.email !== env.superAdminEmail) {
    throw new AppError('Only the super admin can perform this action', 403);
  }
  next();
}