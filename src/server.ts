import { app } from './app';
import { env } from '@/config/env';
import { startKeepAlive, stopKeepAlive } from '@/jobs/keepAlive';
import { initRealtime, realtime } from '@/realtime/socket';
import { logger } from '@/utils/logger';

const server = app.listen(env.port, () => {
  logger.info('Baba Isa Vanguard API started', { port: env.port, env: env.nodeEnv });
  startKeepAlive();
});

// Keep idle connections open longer than the platform load balancer does, so
// it never reuses a socket Node has already closed (which shows up as random
// 502s behind proxies). headersTimeout must be above keepAliveTimeout.
server.keepAliveTimeout = 65_000;
server.headersTimeout = 66_000;

// Live updates share the same port as the REST API.
initRealtime(server);

let shuttingDown = false;

function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;

  logger.info('Shutting down', { signal });
  stopKeepAlive();
  // Open WebSockets would otherwise keep server.close() waiting.
  realtime.disconnectAll();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', {
    message: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined,
  });
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', { message: error.message, stack: error.stack });
  // State is unknown after an uncaught exception: exit and let Render restart us.
  shutdown('uncaughtException');
});
