import { Router } from 'express';
import { apkDownloadController } from './controller';
import { validateBody } from '@/middleware/validate';
import { asyncHandler } from '@/utils/asyncHandler';
import { requireAuth } from '@/middleware/requireAuth';
import { apkInviteLimiter, apkValidateLimiter } from '@/middleware/rateLimit';
import { inviteApkDownloadSchema } from './schemas';

export const apkDownloadRouter = Router();

apkDownloadRouter.post(
  '/invite',
  requireAuth('admin'),
  apkInviteLimiter,
  validateBody(inviteApkDownloadSchema),
  asyncHandler(apkDownloadController.invite)
);

apkDownloadRouter.get(
  '/validate/:token',
  apkValidateLimiter,
  asyncHandler(apkDownloadController.validate)
);