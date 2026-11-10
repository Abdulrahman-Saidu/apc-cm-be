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
  reason: z.string().trim().min(3, 'Rejection reason is required').max(500),
});

export const registryQuerySchema = z.object({
  homeAddress: z.string().trim().max(120).optional(),
  state: z.string().trim().max(60).optional(),
  lga: z.string().trim().max(80).optional(),
  ...paginationFields,
});

export const agentsQuerySchema = z.object({
  ...paginationFields,
});

export const updateAgentSchema = z.object({
  phone: z.string().trim().min(7, 'Enter a valid phone number').max(20),
});