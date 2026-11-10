import { z } from 'zod';

const text = (min: number, max: number) => z.string().trim().min(min).max(max);

const registrationFields = {
  fullName: text(2, 120),
  phone: text(7, 20),
  email: z.string().trim().toLowerCase().email().max(254).optional(),
  nin: text(5, 20).optional(),
  bvn: text(5, 20).optional(),
  eRegNumber: text(0, 40).optional(),
  vin: text(0, 40).optional(),
  homeAddress: text(3, 300),
  state: text(2, 60),
  lga: text(2, 80),
  ward: text(1, 80).optional(),
  accountNumber: text(5, 20).optional(),
  bankName: text(2, 80).optional(),
  accountName: text(2, 120).optional(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
};

export const createRegistrationSchema = z.object(registrationFields);

export const updateRegistrationSchema = z.object(registrationFields).partial();

export const syncRegistrationsSchema = z.object({
  registrations: z
    .array(z.object({ ...registrationFields, localId: z.string().min(1).max(100) }))
    .min(1)
    .max(50),
});

export const myRegistrationsQuerySchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected', 'all']).optional().default('all'),
});