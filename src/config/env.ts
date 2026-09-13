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
      ? required('CLIENT_ORIGIN').split(',')[0].trim()
      : (process.env.CLIENT_ORIGIN ?? '*').split(',')[0].trim(),

  allowedOrigins:
    process.env.NODE_ENV === 'production'
      ? required('CLIENT_ORIGIN').split(',').map((o) => o.trim())
      : (process.env.CLIENT_ORIGIN ?? '*').split(',').map((o) => o.trim()),

  // The API's own public base URL — used for links that must point at
  // this server itself (e.g. the APK download redirect), as opposed to
  // clientOrigin, which points at the dashboard frontend.
  apiPublicUrl:
    process.env.NODE_ENV === 'production'
      ? required('API_PUBLIC_URL')
      : process.env.API_PUBLIC_URL ?? `http://localhost:${process.env.PORT ?? 4000}`,

  supabase: {
    url: required('SUPABASE_URL'),
    serviceRoleKey: required('SUPABASE_SERVICE_ROLE_KEY'),
  },

  jwtSecret: required('JWT_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  otpExpiresMinutes: Number(process.env.OTP_EXPIRES_MINUTES ?? 10),
  agentAppPlaystoreUrl: required('AGENT_APP_PLAYSTORE_URL'),
  superAdminEmail: required('SUPER_ADMIN_EMAIL').toLowerCase(),

  r2: {
    accountId: required('R2_ACCOUNT_ID'),
    accessKeyId: required('R2_ACCESS_KEY_ID'),
    secretAccessKey: required('R2_SECRET_ACCESS_KEY'),
    bucket: process.env.R2_BUCKET ?? 'apk-releases',
    filePath: required('R2_FILE_PATH'),
  },

  brevo: {
    apiKey: required('BREVO_API_KEY'),
    senderEmail: required('BREVO_SENDER_EMAIL'),
    senderName: process.env.BREVO_SENDER_NAME ?? 'VRM',
  },

  googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY,
};