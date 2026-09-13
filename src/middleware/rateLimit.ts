import rateLimit from 'express-rate-limit';

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many attempts. Please try again in a few minutes.' },
});

export const otpVerifyLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 6,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many attempts. Please request a new code.' },
});

export const otpRequestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests. Please wait before trying again.' },
});

export const adminActionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300, // generous — this covers normal dashboard usage (polling overview, browsing queue, etc.)
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests. Please slow down.' },
});

export const apkInviteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20, // an admin sending invites shouldn't hit this in normal use
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many invite requests. Please try again shortly.' },
});

export const apkValidateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10, // per-IP; a real agent only ever needs 1-2 hits on their own link
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many attempts. Please try again shortly.' },
});