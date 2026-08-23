import { z } from 'zod';

const paginationFields = {
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
};

export const queueQuerySchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected', 'all']).optional().default('pending'),
  ...paginationFields,
});

export const rejectSchema = z.object({
  reason: z.string().min(3, 'Rejection reason is required'),
});

export const registryQuerySchema = z.object({
  homeAddress: z.string().optional(),
  state: z.string().optional(),
  lga: z.string().optional(),
  ...paginationFields,
});

export const agentsQuerySchema = z.object({
  ...paginationFields,
});