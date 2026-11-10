import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { env } from '@/config/env';

/** 6-digit code from a cryptographically secure source (Math.random is guessable). */
export function generateOtpCode(): string {
  return String(crypto.randomInt(100000, 1000000));
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