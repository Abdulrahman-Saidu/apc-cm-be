import { z } from 'zod';

const registrationFields = {
  fullName: z
    .string()
    .trim()
    .min(2, 'Full name must be at least 2 characters')
    .max(150, 'Full name is too long'),

  phone: z
    .string()
    .trim()
    .min(7, 'Please enter a valid phone number')
    .max(30, 'Phone number is too long'),

  homeAddress: z
    .string()
    .trim()
    .min(3, 'Address must be at least 3 characters')
    .max(500, 'Address is too long'),

  state: z
    .string()
    .trim()
    .min(2, 'Please select a valid state')
    .max(100, 'State is too long'),

  lga: z
    .string()
    .trim()
    .min(2, 'Please select a valid LGA')
    .max(150, 'LGA is too long'),
};

export const createRegistrationSchema = z.object(registrationFields).strict();

export const syncRegistrationsSchema = z.object({
  registrations: z
    .array(
      z
        .object({
          ...registrationFields,
          localId: z.string().trim().min(1),
        })
        .strict()
    )
    .min(1)
    .max(50),
});

export const myRegistrationsQuerySchema = z.object({
  status: z
    .enum(['pending', 'approved', 'rejected', 'all'])
    .optional()
    .default('all'),
});