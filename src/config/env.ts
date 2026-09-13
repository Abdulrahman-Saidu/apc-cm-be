import 'dotenv/config';

function required(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required env var: ${key}`);
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 4000),
  nodeEnv: process.env.NODE_ENV ?? 'development',

  // Single canonical origin — used for building links (invite emails, APK
  // download links, etc). Always the first entry in CLIENT_ORIGIN.
  clientOrigin:
    process.env.NODE_ENV === 'production'
      ? required('CLIENT_ORIGIN').split(',')[0].trim()
      : (process.env.CLIENT_ORIGIN ?? '*').split(',')[0].trim(),

  // Full list of allowed origins for CORS — supports multiple domains
  // (e.g. a custom domain plus a Vercel preview/staging URL) via a
  // comma-separated CLIENT_ORIGIN env var.
  allowedOrigins:
    process.env.NODE_ENV === 'production'
      ? required('CLIENT_ORIGIN').split(',').map((o) => o.trim())
      : (process.env.CLIENT_ORIGIN ?? '*').split(',').map((o) => o.trim()),

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