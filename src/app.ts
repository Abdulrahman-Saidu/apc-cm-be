import express from 'express';
import compression from 'compression';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from '@/config/env';
import { supabase } from '@/config/supabase';
import { AppError, errorHandler, notFoundHandler } from '@/middleware/errorHandler';
import { logger } from '@/utils/logger';
import { dashboardAuthRouter } from '@/modules/dashboard-auth/routes';
import { mobileAuthRouter } from '@/modules/mobile-auth/routes';
import { mobileRegistrationsRouter } from '@/modules/mobile-registrations/routes';
import { dashboardOpsRouter } from '@/modules/dashboard-ops/routes';
import { apkDownloadRouter } from '@/modules/apk-download/routes';

export const app = express();

// Render sits one proxy in front of us; needed for real client IPs (rate limits).
app.set('trust proxy', 1);

app.use(helmet());

app.use(
  cors({
    origin: (origin, callback) => {
      // No origin header (mobile app, curl, server-to-server): allow.
      if (!origin) return callback(null, true);

      if (env.allowedOrigins.includes('*') || env.allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      logger.warn('Blocked CORS request', { origin });
      return callback(new AppError('Origin not allowed', 403));
    },
    credentials: true,
  })
);

// Gzip JSON responses: lists and exports shrink a lot on mobile data.
app.use(compression());

app.use(express.json({ limit: '200kb' }));

// Health checks: fast, no database, and not written to the request log
// (the keep-alive pings every 10 minutes and would flood it).
const startedAt = Date.now();

app.get('/health', (_req, res) => {
  res.set('Cache-Control', 'no-store').json({
    status: 'ok',
    service: 'baba-isa-vanguard-api',
    uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
  });
});

// Deeper check for monitoring: confirms the database answers too.
app.get('/health/ready', async (_req, res) => {
  res.set('Cache-Control', 'no-store');
  try {
    const { error } = await supabase.from('agent_users').select('id', { head: true, count: 'exact' }).limit(1);
    if (error) throw new Error(error.message);
    res.json({ status: 'ready' });
  } catch (error) {
    logger.error('Readiness check failed', { message: error instanceof Error ? error.message : String(error) });
    res.status(503).json({ status: 'unavailable' });
  }
});

// morgan writes each request line through the structured logger instead of raw stdout text
app.use(
  morgan(env.nodeEnv === 'production' ? 'combined' : 'dev', {
    skip: (req) => (req.url ?? '').startsWith('/health'),
    stream: {
      write: (line: string) => logger.info(line.trim()),
    },
  })
);

app.use('/api/dashboard/auth', dashboardAuthRouter);
app.use('/api/mobile/auth', mobileAuthRouter);
app.use('/api/mobile/registrations', mobileRegistrationsRouter);
app.use('/api/dashboard', dashboardOpsRouter);
app.use('/api/agents/apk', apkDownloadRouter);
app.use(notFoundHandler);
app.use(errorHandler);
