import { NextFunction, Request, Response } from 'express';
import { supabase } from '@/config/supabase';
import { AppError } from './errorHandler';
import { TokenPayload, TokenRole, verifyToken } from '@/utils/jwt';

declare global {
  namespace Express {
    interface Request {
      user?: { id: string; email: string; role: TokenRole };
    }
  }
}

// --- Agent status cache --------------------------------------------------
// A deactivated agent must lose access straight away, not when their 7-day
// token expires. Checking the database on every request is wasteful, so the
// answer is cached for a minute; deactivating clears it immediately.

const AGENT_STATUS_TTL_MS = 60_000;
const agentStatusCache = new Map<string, { active: boolean; expiresAt: number }>();

export function forgetAgentStatus(agentId: string): void {
  agentStatusCache.delete(agentId);
}

async function isAgentActive(agentId: string): Promise<boolean> {
  const cached = agentStatusCache.get(agentId);
  if (cached && cached.expiresAt > Date.now()) return cached.active;

  const { data, error } = await supabase.from('agent_users').select('is_active').eq('id', agentId).maybeSingle();
  if (error) throw new AppError('Something went wrong. Please try again.', 500);

  const active = Boolean(data?.is_active);
  agentStatusCache.set(agentId, { active, expiresAt: Date.now() + AGENT_STATUS_TTL_MS });
  return active;
}

export function requireAuth(role: TokenRole) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const header = req.headers.authorization;
      if (!header?.startsWith('Bearer ')) {
        throw new AppError('Not authenticated', 401);
      }

      let payload: TokenPayload;
      try {
        payload = verifyToken(header.slice('Bearer '.length).trim());
      } catch {
        throw new AppError('Invalid or expired token', 401);
      }

      // Valid token, wrong kind of account (e.g. dashboard token on an agent route).
      if (payload.role !== role) throw new AppError('Not authorized', 403);

      // 401 (not 403) so the mobile app treats it as a finished session and signs out.
      if (role === 'agent' && !(await isAgentActive(payload.sub))) {
        throw new AppError('This account has been disabled', 401);
      }

      req.user = { id: payload.sub, email: payload.email, role: payload.role };
    } catch (error) {
      return next(error);
    }
    // Outside the try: errors from later handlers must not be routed through here.
    next();
  };
}
