import { z } from 'zod';

// Emails are compared exactly in the database, so normalise them on the way in.
const email = z.string().trim().toLowerCase().email().max(254);
// bcrypt only uses the first 72 bytes of a password, so cap new passwords there.
const newPassword = z.string().min(8, 'Password must be at least 8 characters').max(72, 'Password is too long');
const code = z.string().trim().regex(/^\d{6}$/, 'Code must be 6 digits');

export const registerSchema = z.object({
  fullName: z.string().trim().min(2, 'Full name is required').max(120),
  email,
  password: newPassword,
  confirmPassword: z.string().max(72),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

export const verifyOtpSchema = z.object({
  email,
  code,
});

export const resendOtpSchema = z.object({
  email,
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1).max(128),
});

export const forgotPasswordSchema = z.object({
  email,
});

export const verifyResetOtpSchema = z.object({
  email,
  code,
});

export const resetPasswordSchema = z.object({
  resetToken: z.string().min(1).max(2048),
  newPassword,
  confirmPassword: z.string().max(72),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

export const inviteAdminSchema = z.object({
  fullName: z.string().trim().min(2, 'Full name is required').max(120),
  email,
  phone: z.string().trim().min(7, 'Valid phone number is required').max(20),
  role: z.enum(['admin']).default('admin'),
});

export const registerInviteSchema = z.object({
  token: z.string().min(1).max(200),
  fullName: z.string().trim().min(2, 'Full name is required').max(120),
  email,
  phone: z.string().trim().min(7, 'Valid phone number is required').max(20),
  password: newPassword,
  confirmPassword: z.string().max(72),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});