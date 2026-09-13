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
// Postman/tests).
apkDownloadRouter.get(
  '/validate/:token',
  apkValidateLimiter,
  asyncHandler(apkDownloadController.validate)
);

// Email link points here — renders a tap-to-download page.
// Does not consume the token.
apkDownloadRouter.get(
  '/download/:token',
  asyncHandler(apkDownloadController.landing)
);

// Hit when the button on the landing page is tapped — consumes the
// token and redirects straight to the signed R2 URL.
apkDownloadRouter.get(
  '/get/:token',
  apkValidateLimiter,
  asyncHandler(apkDownloadController.getFile)
);