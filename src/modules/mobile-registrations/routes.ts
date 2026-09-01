import { Router } from 'express';
import { mobileRegistrationsController } from './controller';
import { validateBody } from '@/middleware/validate';
import { asyncHandler } from '@/utils/asyncHandler';
import { requireAuth } from '@/middleware/requireAuth';
import { createRegistrationSchema, updateRegistrationSchema, syncRegistrationsSchema } from './schemas';

export const mobileRegistrationsRouter = Router();

mobileRegistrationsRouter.use(requireAuth('agent'));

mobileRegistrationsRouter.post('/', validateBody(createRegistrationSchema), asyncHandler(mobileRegistrationsController.create));
mobileRegistrationsRouter.patch('/:id', validateBody(updateRegistrationSchema), asyncHandler(mobileRegistrationsController.update));
mobileRegistrationsRouter.post('/sync', validateBody(syncRegistrationsSchema), asyncHandler(mobileRegistrationsController.sync));
mobileRegistrationsRouter.get('/me', asyncHandler(mobileRegistrationsController.listMine));
mobileRegistrationsRouter.get('/me/stats', asyncHandler(mobileRegistrationsController.myStats));