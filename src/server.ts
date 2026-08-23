import { app } from './app';
import { env } from '@/config/env';

const server = app.listen(env.port, () => {
  console.log(`VRM backend running on port ${env.port} [${env.nodeEnv}]`);
});

function shutdown(signal: string) {
  console.log(`${signal} received, shutting down gracefully...`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));