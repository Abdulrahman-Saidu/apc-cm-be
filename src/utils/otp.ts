import bcrypt from 'bcryptjs';
import { env } from '@/config/env';

export function generateOtpCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000)); // 6 digits
}

export async function hashOtp(code: string): Promise<string> {
  return bcrypt.hash(code, 10);
}

export async function verifyOtp(code: string, hash: string): Promise<boolean> {
  return bcrypt.compare(code, hash);
}

export function otpExpiryDate(): string {
  return new Date(Date.now() + env.otpExpiresMinutes * 60 * 1000).toISOString();
}

export function isOtpExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return true;
  return new Date(expiresAt).getTime() < Date.now();
}