import { z } from 'zod';

const ninBvnRegex = /^\d{11}$/;

const optionalNonEmptyString = z
  .string()
  .trim()
  .min(1)
  .optional();

const optionalNinBvn = z
  .string()
  .trim()
  .regex(ninBvnRegex, 'Must be exactly 11 digits')
  .optional();

const optionalAccountNumber = z
  .string()
  .trim()
  .regex(
    /^\d{10}$/,
    'Account number must be exactly 10 digits'
  )
  .optional();

/**
 * Required registration fields:
 *
 * - Full name
 * - Phone
 * - Home address
 * - State
 * - LGA
 *
 * All other fields are optional.
 */
const registrationFields = {
  fullName: z
    .string()
    .trim()
    .min(2, 'Full name must be at least 2 characters'),

  phone: z
    .string()
    .trim()
    .min(7, 'Phone number must be at least 7 characters'),

  homeAddress: z
    .string()
    .trim()
    .min(3, 'Home address must be at least 3 characters'),

  state: z
    .string()
    .trim()
    .min(2, 'State is required'),

  lga: z
    .string()
    .trim()
    .min(2, 'LGA is required'),

  email: z
    .string()
    .trim()
    .email('Invalid email address')
    .optional(),

  nin: optionalNinBvn,

  bvn: optionalNinBvn,

  eRegNumber: optionalNonEmptyString,

  vin: optionalNonEmptyString,

  ward: optionalNonEmptyString,

  accountNumber: optionalAccountNumber,

  bankName: optionalNonEmptyString,

  accountName: optionalNonEmptyString,
};

export const createRegistrationSchema = z
  .object(registrationFields)
  .strict();

export const syncRegistrationsSchema = z
  .object({
    registrations: z
      .array(
        z
          .object({
            ...registrationFields,
            localId: z
              .string()
              .trim()
              .min(1, 'localId is required'),
          })
          .strict()
      )
      .min(1)
      .max(50),
  })
  .strict();

export const myRegistrationsQuerySchema = z.object({
  status: z
    .enum([
      'pending',
      'approved',
      'rejected',
      'all',
    ])
    .optional()
    .default('all'),
});