import type { Server as HttpServer } from 'node:http';
import { Server, type Socket } from 'socket.io';
import { env } from '@/config/env';
import { isAgentActive } from '@/middleware/requireAuth';
import { TokenRole, verifyToken } from '@/utils/jwt';
import { logger } from '@/utils/logger';

/**
 * Live updates over WebSockets (Socket.IO).
 *
 * The dashboard and the mobile app connect with the same JWT they use for
 * the REST API. Admins join the "admins" room; each agent joins their own
 * "agent:<id>" room. Services call `realtime.*` after a change is saved,
 * and connected screens refresh themselves.
 *
 * Events only say what changed (ids, status, names); clients fetch full
 * data through the normal API, so permissions stay in one place.
 */

export const LiveEvent = {
  /** A new registration was submitted (admins). */
  RegistrationCreated: 'registration:created',
  /** Offline registrations were synced in a batch (admins). */
  RegistrationsSynced: 'registrations:synced',
  /** An agent edited a pending registration (admins). */
  RegistrationUpdated: 'registration:updated',
  /** A registration was approved or rejected (admins + the agent who submitted it). */
  RegistrationReviewed: 'registration:reviewed',
  /** Agent list changed: invited, activated, deactivated, phone edited (admins). */
  AgentsChanged: 'agents:changed',
  /** The agent's account was deactivated: sign out now (that agent). */
  AccountDisabled: 'account:disabled',
} as const;

const ADMINS_ROOM = 'admins';
const agentRoom = (agentId: string) => `agent:${agentId}`;

type SocketUser = { id: string; role: TokenRole };

let io: Server | null = null;

function isAllowedOrigin(origin: string | undefined): boolean {
  // Mobile apps send no Origin header.
  if (!origin) return true;
  return env.allowedOrigins.includes('*') || env.allowedOrigins.includes(origin);
}

export function initRealtime(server: HttpServer): void {
  io = new Server(server, {
    serveClient: false,
    cors: {
      origin: (origin, callback) => callback(null, isAllowedOrigin(origin)),
      credentials: true,
    },
    // Detect dead phone connections within ~45 s.
    pingInterval: 25_000,
    pingTimeout: 20_000,
  });

  // Every socket must present a valid token, same as the REST API.
  io.use(async (socket: Socket, next) => {
    try {
      const token = typeof socket.handshake.auth?.token === 'string' ? socket.handshake.auth.token : '';
      if (!token) return next(new Error('unauthorized'));

      const payload = verifyToken(token);
      // Only sign-in tokens carry a role; reset tokens and anything else are refused.
      if ((payload.role !== 'admin' && payload.role !== 'agent') || typeof payload.sub !== 'string') {
        return next(new Error('unauthorized'));
      }
      if (payload.role === 'agent' && !(await isAgentActive(payload.sub))) {
        return next(new Error('account_disabled'));
      }

      socket.data.user = { id: payload.sub, role: payload.role } satisfies SocketUser;
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    const user = socket.data.user as SocketUser;
    void socket.join(user.role === 'admin' ? ADMINS_ROOM : agentRoom(user.id));
  });

  logger.info('Live updates ready');
}

function emitSafely(run: (server: Server) => void, event: string) {
  if (!io) return;
  try {
    run(io);
  } catch (error) {
    // A broadcast must never break the request that triggered it.
    logger.warn('Live event failed', { event, reason: error instanceof Error ? error.message : String(error) });
  }
}

export const realtime = {
  toAdmins(event: string, payload: Record<string, unknown> = {}) {
    emitSafely((server) => server.to(ADMINS_ROOM).emit(event, payload), event);
  },

  toAgent(agentId: string, event: string, payload: Record<string, unknown> = {}) {
    emitSafely((server) => server.to(agentRoom(agentId)).emit(event, payload), event);
  },

  /** Tell a deactivated agent's devices to sign out, then drop their connections. */
  signOutAgent(agentId: string) {
    emitSafely((server) => {
      server.to(agentRoom(agentId)).emit(LiveEvent.AccountDisabled, {});
      server.in(agentRoom(agentId)).disconnectSockets(true);
    }, LiveEvent.AccountDisabled);
  },

  /** Close every live connection (used during shutdown). */
  disconnectAll() {
    io?.disconnectSockets(true);
  },
};
