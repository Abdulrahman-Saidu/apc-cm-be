import { Router } from 'express';
import { dashboardAuthController } from './controller';
import { validateBody } from '@/middleware/validate';
import { asyncHandler } from '@/utils/asyncHandler';
import { loginLimiter, otpVerifyLimiter, otpRequestLimiter } from '@/middleware/rateLimit';
import {
  registerSchema,
  verifyOtpSchema,
  resendOtpSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from './schemas';

export const dashboardAuthRouter = Router();

dashboardAuthRouter.post('/register', otpRequestLimiter, validateBody(registerSchema), asyncHandler(dashboardAuthController.register));
dashboardAuthRouter.post('/resend-otp', otpRequestLimiter, validateBody(resendOtpSchema), asyncHandler(dashboardAuthController.resendOtp));
dashboardAuthRouter.post('/verify-otp', otpVerifyLimiter, validateBody(verifyOtpSchema), asyncHandler(dashboardAuthController.verifyOtp));
dashboardAuthRouter.post('/login', loginLimiter, validateBody(loginSchema), asyncHandler(dashboardAuthController.login));
dashboardAuthRouter.post('/forgot-password', otpRequestLimiter, validateBody(forgotPasswordSchema), asyncHandler(dashboardAuthController.forgotPassword));
dashboardAuthRouter.post('/reset-password', otpVerifyLimiter, validateBody(resetPasswordSchema), asyncHandler(dashboardAuthController.resetPassword));