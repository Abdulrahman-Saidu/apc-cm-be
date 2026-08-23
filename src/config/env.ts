import 'dotenv/config';

function required(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required env var: ${key}`);
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 4000),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  clientOrigin:
    process.env.NODE_ENV === 'production'
      ? required('CLIENT_ORIGIN')
      : process.env.CLIENT_ORIGIN ?? '*',

  supabase: {
    url: required('SUPABASE_URL'),
    serviceRoleKey: required('SUPABASE_SERVICE_ROLE_KEY'),
  },

  jwtSecret: required('JWT_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  otpExpiresMinutes: Number(process.env.OTP_EXPIRES_MINUTES ?? 10),

  superAdminEmail: required('SUPER_ADMIN_EMAIL').toLowerCase(),

  brevo: {
    apiKey: required('BREVO_API_KEY'),
    senderEmail: required('BREVO_SENDER_EMAIL'),
    senderName: process.env.BREVO_SENDER_NAME ?? 'VRM',
  },
};