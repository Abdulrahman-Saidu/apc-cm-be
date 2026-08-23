import { supabase } from '@/config/supabase';
import { brevoClient } from '@/config/brevo';
import { env } from '@/config/env';
import { AppError } from '@/middleware/errorHandler';
import { hashPassword, comparePassword } from '@/utils/password';
import { generateOtpCode, hashOtp, verifyOtp, otpExpiryDate, isOtpExpired } from '@/utils/otp';
import { signToken } from '@/utils/jwt';
import { AdminUserRow } from '@/types/db';

const MAX_OTP_ATTEMPTS = 5;
const TABLE = 'admin_users';

async function findByEmail(email: string): Promise<AdminUserRow | null> {
  const { data, error } = await supabase.from(TABLE).select('*').eq('email', email).maybeSingle();
  if (error) throw new AppError('Something went wrong. Please try again.', 500);
  return data;
}

async function issueOtp(adminId: string, email: string, fullName: string, purpose: 'REGISTER' | 'RESET_PASSWORD') {
  const code = generateOtpCode();
  const otp_code_hash = await hashOtp(code);

  const { error } = await supabase
    .from(TABLE)
    .update({ otp_code_hash, otp_purpose: purpose, otp_expires_at: otpExpiryDate(), otp_attempts: 0 })
    .eq('id', adminId);
  if (error) throw new AppError('Something went wrong. Please try again.', 500);

  await brevoClient.sendOtpEmail(email, fullName, code, purpose);
}

export const dashboardAuthService = {
  async register(input: { fullName: string; email: string; password: string }) {
    const email = input.email.toLowerCase();

    if (email !== env.superAdminEmail) {
      throw new AppError('This email is not authorized to register as super admin', 403);
    }

    const existing = await findByEmail(email);
    if (existing?.is_verified) {
      throw new AppError('An account with this email already exists. Please log in.', 409);
    }

    const password_hash = await hashPassword(input.password);

    let admin: AdminUserRow;
    if (existing) {
      const { data, error } = await supabase
        .from(TABLE)
        .update({ full_name: input.fullName, password_hash })
        .eq('id', existing.id)
        .select()
        .single();
      if (error || !data) throw new AppError('Something went wrong. Please try again.', 500);
      admin = data;
    } else {
      const { data, error } = await supabase
        .from(TABLE)
        .insert({ email, full_name: input.fullName, password_hash })
        .select()
        .single();
      if (error || !data) throw new AppError('Something went wrong. Please try again.', 500);
      admin = data;
    }

    await issueOtp(admin.id, admin.email, admin.full_name, 'REGISTER');
    return { email: admin.email };
  },

  async resendOtp(email: string) {
    const admin = await findByEmail(email.toLowerCase());
    if (!admin) throw new AppError('No account found for this email', 404);
    if (admin.is_verified) throw new AppError('Account already verified. Please log in.', 409);

    await issueOtp(admin.id, admin.email, admin.full_name, 'REGISTER');
    return { email: admin.email };
  },

  async verifyOtp(email: string, code: string) {
    const admin = await findByEmail(email.toLowerCase());
    if (!admin || !admin.otp_code_hash || admin.otp_purpose !== 'REGISTER') {
      throw new AppError('Invalid verification request', 400);
    }
    if (isOtpExpired(admin.otp_expires_at)) throw new AppError('Code has expired. Please request a new one.', 400);
    if (admin.otp_attempts >= MAX_OTP_ATTEMPTS) {
      throw new AppError('Too many incorrect attempts. Please request a new code.', 429);
    }

    const valid = await verifyOtp(code, admin.otp_code_hash);
    if (!valid) {
      await supabase.from(TABLE).update({ otp_attempts: admin.otp_attempts + 1 }).eq('id', admin.id);
      throw new AppError('Incorrect code', 400);
    }

    const { data: verified, error } = await supabase
      .from(TABLE)
      .update({ is_verified: true, otp_code_hash: null, otp_purpose: null, otp_expires_at: null, otp_attempts: 0 })
      .eq('id', admin.id)
      .select()
      .single();
    if (error || !verified) throw new AppError('Something went wrong. Please try again.', 500);

    const token = signToken({ sub: verified.id, role: 'admin', email: verified.email });
    return { token, admin: { id: verified.id, email: verified.email, fullName: verified.full_name } };
  },

  async login(email: string, password: string) {
    const admin = await findByEmail(email.toLowerCase());
    if (!admin || !admin.password_hash) throw new AppError('Invalid email or password', 401);
    if (!admin.is_verified) throw new AppError('Please verify your account first', 403);

    const valid = await comparePassword(password, admin.password_hash);
    if (!valid) throw new AppError('Invalid email or password', 401);

    const token = signToken({ sub: admin.id, role: 'admin', email: admin.email });
    return { token, admin: { id: admin.id, email: admin.email, fullName: admin.full_name } };
  },

  async forgotPassword(email: string) {
    const admin = await findByEmail(email.toLowerCase());
    if (admin?.is_verified) {
      await issueOtp(admin.id, admin.email, admin.full_name, 'RESET_PASSWORD');
    }
    return { message: 'If an account exists for this email, a code has been sent.' };
  },

  async resetPassword(email: string, code: string, newPassword: string) {
    const admin = await findByEmail(email.toLowerCase());
    if (!admin || !admin.otp_code_hash || admin.otp_purpose !== 'RESET_PASSWORD') {
      throw new AppError('Invalid reset request', 400);
    }
    if (isOtpExpired(admin.otp_expires_at)) throw new AppError('Code has expired. Please request a new one.', 400);
    if (admin.otp_attempts >= MAX_OTP_ATTEMPTS) {
      throw new AppError('Too many incorrect attempts. Please request a new code.', 429);
    }

    const valid = await verifyOtp(code, admin.otp_code_hash);
    if (!valid) {
      await supabase.from(TABLE).update({ otp_attempts: admin.otp_attempts + 1 }).eq('id', admin.id);
      throw new AppError('Incorrect code', 400);
    }

    const password_hash = await hashPassword(newPassword);
    const { error } = await supabase
      .from(TABLE)
      .update({ password_hash, otp_code_hash: null, otp_purpose: null, otp_expires_at: null, otp_attempts: 0 })
      .eq('id', admin.id);
    if (error) throw new AppError('Something went wrong. Please try again.', 500);

    return { message: 'Password reset successfully' };
  },
};