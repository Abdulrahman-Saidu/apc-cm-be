import jwt from 'jsonwebtoken';
import { env } from '@/config/env';

export type TokenRole = 'admin' | 'agent';

export interface TokenPayload {
  sub: string;
  role: TokenRole;
  email: string;
}

export function signToken(payload: TokenPayload): string {
  const options: jwt.SignOptions = { expiresIn: env.jwtExpiresIn as jwt.SignOptions['expiresIn'] };
  return jwt.sign(payload, env.jwtSecret, options);
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, env.jwtSecret) as TokenPayload;
}