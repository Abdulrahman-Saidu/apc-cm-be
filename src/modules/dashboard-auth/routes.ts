import { Router } from 'express';
import { dashboardAuthController } from './controller';
import { validateBody } from '@/middleware/validate';
import { asyncHandler } from '@/utils/asyncHandler';
import { requireAuth } from '@/middleware/requireAuth';
import { requireSuperAdmin } from '@/middleware/requireSuperAdmin';
import { loginLimiter, otpVerifyLimiter, otpRequestLimiter } from '@/middleware/rateLimit';
import {
  registerSchema,
  verifyOtpSchema,
  resendOtpSchema,
  loginSchema,
  forgotPasswordSchema,
  verifyResetOtpSchema,
  resetPasswordSchema,
  inviteAdminSchema,
  registerInviteSchema,
} from './schemas';

export const dashboardAuthRouter = Router();

dashboardAuthRouter.post('/register', otpRequestLimiter, validateBody(registerSchema), asyncHandler(dashboardAuthController.register));
dashboardAuthRouter.post('/resend-otp', otpRequestLimiter, validateBody(resendOtpSchema), asyncHandler(dashboardAuthController.resendOtp));
dashboardAuthRouter.post('/verify-otp', otpVerifyLimiter, validateBody(verifyOtpSchema), asyncHandler(dashboardAuthController.verifyOtp));
dashboardAuthRouter.post('/login', loginLimiter, validateBody(loginSchema), asyncHandler(dashboardAuthController.login));
dashboardAuthRouter.post('/forgot-password', otpRequestLimiter, validateBody(forgotPasswordSchema), asyncHandler(dashboardAuthController.forgotPassword));
dashboardAuthRouter.post('/verify-reset-otp', otpVerifyLimiter, validateBody(verifyResetOtpSchema), asyncHandler(dashboardAuthController.verifyResetOtp));
dashboardAuthRouter.post('/reset-password', otpVerifyLimiter, validateBody(resetPasswordSchema), asyncHandler(dashboardAuthController.resetPassword));

// Super admin only — invite a new dashboard admin.
dashboardAuthRouter.post(
  '/invite-admin',
  requireAuth('admin'),
  requireSuperAdmin,
  otpRequestLimiter,
  validateBody(inviteAdminSchema),
  asyncHandler(dashboardAuthController.inviteAdmin)
);

// Public — invitee completes registration using the token from their invite email.
dashboardAuthRouter.post(
  '/register-invite',
  otpRequestLimiter,
  validateBody(registerInviteSchema),
  asyncHandler(dashboardAuthController.registerInvite)
);