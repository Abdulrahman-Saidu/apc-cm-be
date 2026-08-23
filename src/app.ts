import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from '@/config/env';
import { errorHandler, notFoundHandler } from '@/middleware/errorHandler';
import { dashboardAuthRouter } from '@/modules/dashboard-auth/routes';
import { mobileAuthRouter } from '@/modules/mobile-auth/routes';

export const app = express();

app.use(helmet());
app.use(cors({ origin: env.clientOrigin, credentials: true }));
app.use(express.json());
app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev'));

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.use('/api/dashboard/auth', dashboardAuthRouter);
app.use('/api/mobile/auth', mobileAuthRouter);

app.use(notFoundHandler);
app.use(errorHandler);