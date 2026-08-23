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
}

export function signToken(payload: TokenPayload): string {
  const options: jwt.SignOptions = { expiresIn: env.jwtExpiresIn as jwt.SignOptions['expiresIn'] };
  return jwt.sign(payload, env.jwtSecret, options);
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, env.jwtSecret) as TokenPayload;
}

export function signResetToken(payload: Omit<ResetTokenPayload, 'purpose'>): string {
  return jwt.sign({ ...payload, purpose: 'password_reset' }, env.jwtSecret, { expiresIn: '15m' });
}

export function verifyResetToken(token: string): ResetTokenPayload {
  const decoded = jwt.verify(token, env.jwtSecret) as ResetTokenPayload;
  if (decoded.purpose !== 'password_reset') throw new Error('Invalid token purpose');
  return decoded;
}