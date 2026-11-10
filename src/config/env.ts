import 'dotenv/config';

function required(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required env var: ${key}`);
  return value;
}

function bool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === '') return fallback;
  return !['false', '0', 'no', 'off'].includes(value.trim().toLowerCase());
}

function trimSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

const isProduction = process.env.NODE_ENV === 'production';

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

  apiPublicUrl: trimSlash(
    isProduction
      ? required('API_PUBLIC_URL')
      : process.env.API_PUBLIC_URL ?? `http://localhost:${process.env.PORT ?? 4000}`
  ),

  supabase: {
    url: required('SUPABASE_URL'),
    serviceRoleKey: required('SUPABASE_SERVICE_ROLE_KEY'),
  },

  jwtSecret: required('JWT_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  otpExpiresMinutes: Number(process.env.OTP_EXPIRES_MINUTES ?? 10),
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
    senderName: process.env.BREVO_SENDER_NAME ?? 'Baba Isa Vanguard',
  },

  /**
   * Keeps a Render free instance awake by calling its own public /health
   * every few minutes (Render sleeps a free service after 15 idle minutes).
   * On by default in production; set KEEP_ALIVE=false to turn it off.
   * URL: KEEP_ALIVE_URL, else Render's RENDER_EXTERNAL_URL, else API_PUBLIC_URL.
   */
  keepAlive: {
    enabled: bool(process.env.KEEP_ALIVE, isProduction),
    url: `${trimSlash(
      process.env.KEEP_ALIVE_URL ?? process.env.RENDER_EXTERNAL_URL ?? process.env.API_PUBLIC_URL ?? `http://localhost:${process.env.PORT ?? 4000}`
    )}/health`,
    intervalMinutes: Math.max(1, Number(process.env.KEEP_ALIVE_INTERVAL_MINUTES ?? 10)),
  },

  googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY,
};