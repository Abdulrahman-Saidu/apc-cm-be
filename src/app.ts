import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from '@/config/env';
import { errorHandler, notFoundHandler } from '@/middleware/errorHandler';
import { dashboardAuthRouter } from '@/modules/dashboard-auth/routes';
import { mobileAuthRouter } from '@/modules/mobile-auth/routes';

export const app = express();

// Render (and most hosts) sit behind a reverse proxy — trust its X-Forwarded-For
// header so express-rate-limit can correctly identify the real client IP instead
// of throwing on it.
app.set('trust proxy', 1);

app.use(helmet());
app.use(cors({ origin: env.clientOrigin, credentials: true }));
app.use(express.json());
app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev'));

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.use('/api/dashboard/auth', dashboardAuthRouter);
app.use('/api/mobile/auth', mobileAuthRouter);

app.use(notFoundHandler);
app.use(errorHandler);