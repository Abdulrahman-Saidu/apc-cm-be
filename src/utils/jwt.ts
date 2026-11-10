import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '@/config/env';

export type TokenRole = 'admin' | 'agent';

export interface TokenPayload {
  sub: string;
  role: TokenRole;
  email: string;
}

export interface ResetTokenPayload {
  sub: string;
  email: string;
  purpose: 'password_reset';
  /** Fingerprint of the password hash at issue time; makes the token single-use. */
  pwf: string;
}

const ALGORITHM = 'HS256' as const;

export function signToken(payload: TokenPayload): string {
  const options: jwt.SignOptions = {
    algorithm: ALGORITHM,
    expiresIn: env.jwtExpiresIn as jwt.SignOptions['expiresIn'],
  };
  return jwt.sign(payload, env.jwtSecret, options);
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, env.jwtSecret, { algorithms: [ALGORITHM] }) as TokenPayload;
}

/**
 * Short fingerprint of the stored password hash. A reset token carries the
 * fingerprint from when it was issued; once the password changes, the
 * fingerprint no longer matches, so the same token can't be used twice.
 */
export function passwordFingerprint(passwordHash: string | null): string {
  return crypto
    .createHash('sha256')
    .update(passwordHash ?? 'no-password')
    .digest('base64url')
    .slice(0, 16);
}

export function signResetToken(payload: Omit<ResetTokenPayload, 'purpose'>): string {
  return jwt.sign({ ...payload, purpose: 'password_reset' }, env.jwtSecret, {
    algorithm: ALGORITHM,
    expiresIn: '15m',
  });
}

export function verifyResetToken(token: string): ResetTokenPayload {
  const decoded = jwt.verify(token, env.jwtSecret, { algorithms: [ALGORITHM] }) as ResetTokenPayload;
  if (decoded.purpose !== 'password_reset' || !decoded.pwf) throw new Error('Invalid token purpose');
  return decoded;
}
