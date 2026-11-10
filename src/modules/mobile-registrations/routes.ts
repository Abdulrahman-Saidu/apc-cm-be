import { Router } from 'express';
import { mobileRegistrationsController } from './controller';
import { validateBody, validateIdParam, validateQuery } from '@/middleware/validate';
import { asyncHandler } from '@/utils/asyncHandler';
import { requireAuth } from '@/middleware/requireAuth';
import { createRegistrationSchema, updateRegistrationSchema, syncRegistrationsSchema, myRegistrationsQuerySchema } from './schemas';

export const mobileRegistrationsRouter = Router();

mobileRegistrationsRouter.use(requireAuth('agent'));

mobileRegistrationsRouter.post('/', validateBody(createRegistrationSchema), asyncHandler(mobileRegistrationsController.create));
mobileRegistrationsRouter.patch('/:id', validateIdParam(), validateBody(updateRegistrationSchema), asyncHandler(mobileRegistrationsController.update));
mobileRegistrationsRouter.post('/sync', validateBody(syncRegistrationsSchema), asyncHandler(mobileRegistrationsController.sync));
mobileRegistrationsRouter.get('/me', validateQuery(myRegistrationsQuerySchema), asyncHandler(mobileRegistrationsController.listMine));
mobileRegistrationsRouter.get('/me/stats', asyncHandler(mobileRegistrationsController.myStats));