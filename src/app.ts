import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from '@/config/env';
import { errorHandler, notFoundHandler } from '@/middleware/errorHandler';
import { logger } from '@/utils/logger';
import { dashboardAuthRouter } from '@/modules/dashboard-auth/routes';
import { mobileAuthRouter } from '@/modules/mobile-auth/routes';
import { mobileRegistrationsRouter } from '@/modules/mobile-registrations/routes';
import { dashboardOpsRouter } from '@/modules/dashboard-ops/routes';
import { apkDownloadRouter } from '@/modules/apk-download/routes';
export const app = express();

app.set('trust proxy', 1);

app.use(helmet());

app.use(
  cors({
    origin: (origin, callback) => {
      // No origin header (e.g. curl, Postman, server-to-server) — allow.
      if (!origin) return callback(null, true);

      if (env.allowedOrigins.includes('*') || env.allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      logger.warn('Blocked CORS request', { origin });
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  })
);

app.use(express.json());

// morgan writes each request line through the structured logger instead of raw stdout text
app.use(
  morgan(env.nodeEnv === 'production' ? 'combined' : 'dev', {
    stream: {
      write: (line: string) => logger.info(line.trim()),
    },
  })
);

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.use('/api/dashboard/auth', dashboardAuthRouter);
app.use('/api/mobile/auth', mobileAuthRouter);
app.use('/api/mobile/registrations', mobileRegistrationsRouter);
app.use('/api/dashboard', dashboardOpsRouter);
app.use('/api/agents/apk', apkDownloadRouter);
app.use(notFoundHandler);
app.use(errorHandler);