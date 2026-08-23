import { Router } from 'express';
import { mobileAuthController } from './controller';
import { validateBody } from '@/middleware/validate';
import { asyncHandler } from '@/utils/asyncHandler';
import { requireAuth } from '@/middleware/requireAuth';
import { loginLimiter, otpVerifyLimiter, otpRequestLimiter } from '@/middleware/rateLimit';
import {
  inviteAgentSchema,
  registerInviteSchema,
  verifyOtpSchema,
  resendOtpSchema,
  loginSchema,
  forgotPasswordSchema,
  verifyResetOtpSchema,
  resetPasswordSchema,
} from './schemas';

export const mobileAuthRouter = Router();

// Any authenticated dashboard admin (super admin or invited) can invite an agent.
mobileAuthRouter.post(
  '/invite-agent',
  requireAuth('admin'),
  otpRequestLimiter,
  validateBody(inviteAgentSchema),
  asyncHandler(mobileAuthController.inviteAgent)
);

mobileAuthRouter.post('/register-invite', otpRequestLimiter, validateBody(registerInviteSchema), asyncHandler(mobileAuthController.registerInvite));
mobileAuthRouter.post('/resend-otp', otpRequestLimiter, validateBody(resendOtpSchema), asyncHandler(mobileAuthController.resendOtp));
mobileAuthRouter.post('/verify-otp', otpVerifyLimiter, validateBody(verifyOtpSchema), asyncHandler(mobileAuthController.verifyOtp));
mobileAuthRouter.post('/login', loginLimiter, validateBody(loginSchema), asyncHandler(mobileAuthController.login));
mobileAuthRouter.post('/forgot-password', otpRequestLimiter, validateBody(forgotPasswordSchema), asyncHandler(mobileAuthController.forgotPassword));
mobileAuthRouter.post('/verify-reset-otp', otpVerifyLimiter, validateBody(verifyResetOtpSchema), asyncHandler(mobileAuthController.verifyResetOtp));
mobileAuthRouter.post('/reset-password', otpVerifyLimiter, validateBody(resetPasswordSchema), asyncHandler(mobileAuthController.resetPassword));