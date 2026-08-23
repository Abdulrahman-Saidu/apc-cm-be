import { z } from 'zod';

export const queueQuerySchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected', 'all']).optional().default('pending'),
});

export const rejectSchema = z.object({
  reason: z.string().min(3, 'Rejection reason is required'),
});

export const registryQuerySchema = z.object({
  homeAddress: z.string().optional(),
  state: z.string().optional(),
  lga: z.string().optional(),
});