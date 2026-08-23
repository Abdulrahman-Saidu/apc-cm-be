import { z } from 'zod';

export const registerSchema = z.object({
  fullName: z.string().min(2, 'Full name is required'),
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

export const verifyOtpSchema = z.object({
  email: z.string().email(),
  code: z.string().length(6),
});

export const resendOtpSchema = z.object({
  email: z.string().email(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const verifyResetOtpSchema = z.object({
  email: z.string().email(),
  code: z.string().length(6),
});

export const resetPasswordSchema = z.object({
  resetToken: z.string().min(1),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

export const inviteAdminSchema = z.object({
  fullName: z.string().min(2, 'Full name is required'),
  email: z.string().email(),
  phone: z.string().min(7, 'Valid phone number is required'),
  role: z.enum(['admin']).default('admin'),
});

export const registerInviteSchema = z.object({
  token: z.string().min(1),
  fullName: z.string().min(2, 'Full name is required'),
  email: z.string().email(),
  phone: z.string().min(7, 'Valid phone number is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});