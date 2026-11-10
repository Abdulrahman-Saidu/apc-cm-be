import { supabase } from '@/config/supabase';
import { brevoClient } from '@/config/brevo';
import { AppError } from '@/middleware/errorHandler';
import { hashPassword, comparePassword, burnPasswordCheck } from '@/utils/password';
import { generateOtpCode, hashOtp, verifyOtp as compareOtp, otpExpiryDate, isOtpExpired } from '@/utils/otp';
import { signToken, signResetToken, verifyResetToken, passwordFingerprint } from '@/utils/jwt';
import { apkDownloadService } from '@/modules/apk-download/service';

const TABLE = 'agent_users';
const MAX_OTP_ATTEMPTS = 5;
const GENERIC_ERROR = 'Something went wrong. Please try again.';

// Emails arrive lowercased from the schemas; this also covers internal callers.
const normalise = (email: string) => email.trim().toLowerCase();

/**
 * Guarded increment: only applies if otp_attempts still holds the value we
 * read, so two wrong codes submitted at the same moment can't both slip
 * through as a single attempt.
 */
async function incrementOtpAttempts(agentId: string, currentAttempts: number) {
  await supabase
    .from(TABLE)
    .update({ otp_attempts: currentAttempts + 1 })
    .eq('id', agentId)
    .eq('otp_attempts', currentAttempts);
}

async function issueOtp(agent: { id: string; email: string; full_name: string }, purpose: 'REGISTER' | 'RESET_PASSWORD') {
  const code = generateOtpCode();
  const codeHash = await hashOtp(code);

  const { error } = await supabase
    .from(TABLE)
    .update({ otp_code_hash: codeHash, otp_purpose: purpose, otp_expires_at: otpExpiryDate(), otp_attempts: 0 })
    .eq('id', agent.id);
  if (error) throw new AppError(GENERIC_ERROR, 500);

  await brevoClient.sendOtpEmail(agent.email, agent.full_name, code, purpose);
}

export const mobileAuthService = {
  async inviteAgent(
    invitedByAdminId: string,
    data: { fullName: string; email: string; phone: string; lga: string; role: string }
  ) {
    const email = normalise(data.email);

    const { data: existing, error: findError } = await supabase
      .from(TABLE)
      .select('id, agent_code, password_hash')
      .eq('email', email)
      .maybeSingle();
    if (findError) throw new AppError(GENERIC_ERROR, 500);

    if (existing?.password_hash) throw new AppError('An agent with this email already exists', 409);

    let agent: { id: string; agent_code: string; email: string; full_name: string };

    if (existing) {
      // Invited before but never registered (e.g. the first email never
      // arrived): refresh their details and send the invite again.
      const { data: updated, error } = await supabase
        .from(TABLE)
        .update({ full_name: data.fullName, phone: data.phone, lga: data.lga, role: data.role })
        .eq('id', existing.id)
        .select('id, agent_code, email, full_name')
        .single();
      if (error || !updated) throw new AppError('Failed to update agent invite', 500);
      agent = updated;
    } else {
      const { data: created, error } = await supabase
        .from(TABLE)
        .insert({ full_name: data.fullName, email, phone: data.phone, lga: data.lga, role: data.role })
        .select('id, agent_code, email, full_name')
        .single();
      if (error || !created) throw new AppError('Failed to create agent invite', 500);
      agent = created;
    }

    const { downloadLink } = await apkDownloadService.createInviteToken(invitedByAdminId, agent.email);
    await brevoClient.sendAgentInviteEmail(agent.email, agent.full_name, agent.agent_code, downloadLink);

    return { agentId: agent.id, agentCode: agent.agent_code, resent: Boolean(existing) };
  },

  async registerInvite(data: { email: string; password: string }) {
    const email = normalise(data.email);

    const { data: agent, error } = await supabase
      .from(TABLE)
      .select('id, full_name, email, password_hash, is_active, otp_purpose')
      .eq('email', email)
      .maybeSingle();

    if (error) throw new AppError(GENERIC_ERROR, 500);
    if (!agent) throw new AppError('No invitation found for this email', 404);
    if (!agent.is_active) throw new AppError('This agent account has been disabled', 403);

    // Registered AND verified: send them to login. Registered but never
    // verified: let them set the password again and get a fresh code,
    // instead of leaving them stuck.
    const unverified = agent.otp_purpose === 'REGISTER';
    if (agent.password_hash && !unverified) throw new AppError('This agent has already registered', 409);

    const passwordHash = await hashPassword(data.password);
    const { error: updateError } = await supabase.from(TABLE).update({ password_hash: passwordHash }).eq('id', agent.id);
    if (updateError) throw new AppError('Failed to complete registration', 500);

    await issueOtp(agent, 'REGISTER');

    return { email: agent.email };
  },

  async resendOtp(rawEmail: string) {
    const email = normalise(rawEmail);

    const { data: agent, error } = await supabase
      .from(TABLE)
      .select('id, full_name, email, otp_purpose')
      .eq('email', email)
      .maybeSingle();

    if (error) throw new AppError(GENERIC_ERROR, 500);
    if (!agent) throw new AppError('Agent not found', 404);
    if (!agent.otp_purpose) throw new AppError('No pending verification for this account', 400);

    await issueOtp(agent, agent.otp_purpose as 'REGISTER' | 'RESET_PASSWORD');

    return { email: agent.email };
  },

  async verifyOtp(rawEmail: string, code: string) {
    const email = normalise(rawEmail);

    const { data: agent, error } = await supabase
      .from(TABLE)
      .select('id, otp_code_hash, otp_purpose, otp_expires_at, otp_attempts')
      .eq('email', email)
      .maybeSingle();

    if (error) throw new AppError(GENERIC_ERROR, 500);
    if (!agent) throw new AppError('Agent not found', 404);
    if (agent.otp_purpose !== 'REGISTER') throw new AppError('No registration verification pending', 400);
    if (!agent.otp_code_hash || isOtpExpired(agent.otp_expires_at)) {
      throw new AppError('OTP has expired, please request a new one', 400);
    }
    if (agent.otp_attempts >= MAX_OTP_ATTEMPTS) throw new AppError('Too many attempts, request a new OTP', 429);

    const valid = await compareOtp(code, agent.otp_code_hash);
    if (!valid) {
      await incrementOtpAttempts(agent.id, agent.otp_attempts);
      throw new AppError('Invalid OTP code', 400);
    }

    const { error: clearError } = await supabase
      .from(TABLE)
      .update({ otp_code_hash: null, otp_purpose: null, otp_expires_at: null, otp_attempts: 0 })
      .eq('id', agent.id);
    if (clearError) throw new AppError(GENERIC_ERROR, 500);

    return { verified: true };
  },

  async login(rawEmail: string, password: string) {
    const email = normalise(rawEmail);

    const { data: agent, error } = await supabase
      .from(TABLE)
      .select('id, full_name, email, password_hash, is_active, agent_code, role, lga, phone, otp_purpose')
      .eq('email', email)
      .maybeSingle();

    if (error) throw new AppError(GENERIC_ERROR, 500);

    if (!agent || !agent.password_hash) {
      // Same work as a real check, so timing doesn't reveal which emails exist.
      await burnPasswordCheck(password);
      if (agent && !agent.password_hash) throw new AppError('Please complete registration first', 403);
      throw new AppError('Invalid email or password', 401);
    }

    const valid = await comparePassword(password, agent.password_hash);
    if (!valid) throw new AppError('Invalid email or password', 401);

    // Checked after the password, so these states aren't revealed to strangers.
    if (!agent.is_active) throw new AppError('This account has been disabled', 403);
    // Set a password but never entered the activation code.
    if (agent.otp_purpose === 'REGISTER') throw new AppError('Please complete registration first', 403);

    const token = signToken({ sub: agent.id, role: 'agent', email: agent.email });

    return {
      token,
      agent: {
        id: agent.id,
        agentCode: agent.agent_code,
        fullName: agent.full_name,
        email: agent.email,
        lga: agent.lga,
        phone: agent.phone,
        role: agent.role,
      },
    };
  },

  // The mobile app relies on these specific messages (404 / 403) to guide
  // the agent, so they are kept as they are. Requests are rate limited.
  async forgotPassword(rawEmail: string) {
    const email = normalise(rawEmail);

    const { data: agent, error } = await supabase
      .from(TABLE)
      .select('id, full_name, email, password_hash, is_active')
      .eq('email', email)
      .maybeSingle();

    if (error) throw new AppError(GENERIC_ERROR, 500);
    if (!agent) throw new AppError('No account found for this email', 404);
    if (!agent.is_active) throw new AppError('This account has been disabled', 403);
    if (!agent.password_hash) throw new AppError('Please complete registration first', 403);

    await issueOtp(agent, 'RESET_PASSWORD');

    return { email: agent.email };
  },

  async verifyResetOtp(rawEmail: string, code: string) {
    const email = normalise(rawEmail);

    const { data: agent, error } = await supabase
      .from(TABLE)
      .select('id, email, password_hash, otp_code_hash, otp_purpose, otp_expires_at, otp_attempts')
      .eq('email', email)
      .maybeSingle();

    if (error) throw new AppError(GENERIC_ERROR, 500);
    if (!agent) throw new AppError('Agent not found', 404);
    if (agent.otp_purpose !== 'RESET_PASSWORD') throw new AppError('No password reset pending', 400);
    if (!agent.otp_code_hash || isOtpExpired(agent.otp_expires_at)) {
      throw new AppError('OTP has expired, please request a new one', 400);
    }
    if (agent.otp_attempts >= MAX_OTP_ATTEMPTS) throw new AppError('Too many attempts, request a new OTP', 429);

    const valid = await compareOtp(code, agent.otp_code_hash);
    if (!valid) {
      await incrementOtpAttempts(agent.id, agent.otp_attempts);
      throw new AppError('Invalid OTP code', 400);
    }

    const { error: clearError } = await supabase
      .from(TABLE)
      .update({ otp_code_hash: null, otp_purpose: null, otp_expires_at: null, otp_attempts: 0 })
      .eq('id', agent.id);
    if (clearError) throw new AppError(GENERIC_ERROR, 500);

    const resetToken = signResetToken({ sub: agent.id, email: agent.email, pwf: passwordFingerprint(agent.password_hash) });

    return { resetToken };
  },

  async resetPassword(resetToken: string, newPassword: string) {
    let payload;
    try {
      payload = verifyResetToken(resetToken);
    } catch {
      throw new AppError('Invalid or expired reset token', 401);
    }

    const { data: agent, error } = await supabase
      .from(TABLE)
      .select('id, password_hash, is_active')
      .eq('id', payload.sub)
      .maybeSingle();
    if (error) throw new AppError(GENERIC_ERROR, 500);

    // Missing account, or the password already changed since the token was
    // issued (token already used): either way the token is spent.
    if (!agent || passwordFingerprint(agent.password_hash) !== payload.pwf) {
      throw new AppError('Invalid or expired reset token', 401);
    }
    if (!agent.is_active) throw new AppError('This account has been disabled', 403);

    const passwordHash = await hashPassword(newPassword);
    const { data: updated, error: updateError } = await supabase
      .from(TABLE)
      .update({ password_hash: passwordHash })
      .eq('id', agent.id)
      // Only if nothing changed in between (two resets racing with one token).
      .eq('password_hash', agent.password_hash ?? '')
      .select('id');
    if (updateError) throw new AppError('Failed to reset password', 500);
    if (!updated || updated.length === 0) throw new AppError('Invalid or expired reset token', 401);

    return { message: 'Password reset successful' };
  },
};
