import { z } from 'zod';

const registrationFields = {
  fullName: z.string().min(2),
  phone: z.string().min(7),
  email: z.string().email().optional(),
  nin: z.string().min(5),
  bvn: z.string().min(5),
  eRegNumber: z.string().optional(),
  vin: z.string().optional(),
  homeAddress: z.string().min(3),
  state: z.string().min(2),
  lga: z.string().min(2),
  ward: z.string().min(1),
  accountNumber: z.string().min(5),
  bankName: z.string().min(2),
  accountName: z.string().min(2),
};

export const createRegistrationSchema = z.object(registrationFields);

export const syncRegistrationsSchema = z.object({
  registrations: z
    .array(z.object({ ...registrationFields, localId: z.string() }))
    .min(1)
    .max(50),
});

export const myRegistrationsQuerySchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected', 'all']).optional().default('all'),
});