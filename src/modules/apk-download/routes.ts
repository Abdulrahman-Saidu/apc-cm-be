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

// Programmatic check — returns JSON with the signed URL (used by
// Postman/tests or a future frontend page).
apkDownloadRouter.get(
  '/validate/:token',
  apkValidateLimiter,
  asyncHandler(apkDownloadController.validate)
);

// Direct-click endpoint — the link in the invite email points here.
// Redirects straight to the signed R2 URL; no frontend page involved.
apkDownloadRouter.get(
  '/download/:token',
  apkValidateLimiter,
  asyncHandler(apkDownloadController.download)
);