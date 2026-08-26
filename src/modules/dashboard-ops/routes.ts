import { Router } from 'express';
import { dashboardOpsController } from './controller';
import { validateBody, validateQuery } from '@/middleware/validate';
import { asyncHandler } from '@/utils/asyncHandler';
import { requireAuth } from '@/middleware/requireAuth';
import { adminActionLimiter } from '@/middleware/rateLimit';
import { queueQuerySchema, rejectSchema, registryQuerySchema, agentsQuerySchema } from './schemas';

export const dashboardOpsRouter = Router();

dashboardOpsRouter.use(requireAuth('admin'));
dashboardOpsRouter.use(adminActionLimiter);

dashboardOpsRouter.get('/overview', asyncHandler(dashboardOpsController.overview));

dashboardOpsRouter.get('/agents', validateQuery(agentsQuerySchema), asyncHandler(dashboardOpsController.listAgents));
dashboardOpsRouter.patch('/agents/:id/activate', asyncHandler(dashboardOpsController.activateAgent));
dashboardOpsRouter.patch('/agents/:id/deactivate', asyncHandler(dashboardOpsController.deactivateAgent));

dashboardOpsRouter.get('/queue', validateQuery(queueQuerySchema), asyncHandler(dashboardOpsController.listQueue));
dashboardOpsRouter.patch('/queue/:id/approve', asyncHandler(dashboardOpsController.approve));
dashboardOpsRouter.patch('/queue/:id/reject', validateBody(rejectSchema), asyncHandler(dashboardOpsController.reject));

dashboardOpsRouter.get('/registry', validateQuery(registryQuerySchema), asyncHandler(dashboardOpsController.listRegistry));
dashboardOpsRouter.get('/registry/export', validateQuery(registryQuerySchema), asyncHandler(dashboardOpsController.exportRegistry));