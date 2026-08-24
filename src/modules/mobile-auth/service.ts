import { supabase } from '@/config/supabase';
import { brevoClient } from '@/config/brevo';
import { env } from '@/config/env';
import { AppError } from '@/middleware/errorHandler';
import { hashPassword, comparePassword } from '@/utils/password';
import { generateOtpCode, hashOtp, verifyOtp as compareOtp, otpExpiryDate, isOtpExpired } from '@/utils/otp';
import { signToken, signResetToken, verifyResetToken } from '@/utils/jwt';

export const mobileAuthService = {
  async inviteAgent(
    invitedByAdminId: string,
    invitedByAdminName: string,
    data: { fullName: string; email: string; phone: string; lga: string; role: string }
  ) {
    const { data: existing } = await supabase
      .from('agent_users')
      .select('id')
      .eq('email', data.email)
      .maybeSingle();

    if (existing) throw new AppError('An agent with this email already exists', 409);

    const { data: agent, error } = await supabase
      .from('agent_users')
      .insert({
        full_name: data.fullName,
        email: data.email,
        phone: data.phone,
        lga: data.lga,
        role: data.role,
      })
      .select('id, agent_code, email, full_name')
      .single();

    if (error || !agent) throw new AppError('Failed to create agent invite', 500);

    await brevoClient.sendAgentInviteEmail(
      agent.email,
      agent.full_name,
      agent.agent_code,
      env.agentAppPlaystoreUrl,
      invitedByAdminName
    );

    return { agentId: agent.id, agentCode: agent.agent_code };
  },

  async registerInvite(data: { email: string; password: string }) {
    const { data: agent, error } = await supabase
      .from('agent_users')
      .select('id, full_name, email, password_hash, is_active')
      .eq('email', data.email)
      .maybeSingle();

    if (error || !agent) throw new AppError('No invitation found for this email', 404);
    if (!agent.is_active) throw new AppError('This agent account has been disabled', 403);
    if (agent.password_hash) throw new AppError('This agent has already registered', 409);

    const passwordHash = await hashPassword(data.password);
    const code = generateOtpCode();
    const codeHash = await hashOtp(code);

    const { error: updateError } = await supabase
      .from('agent_users')
      .update({
        password_hash: passwordHash,
        otp_code_hash: codeHash,
        otp_purpose: 'REGISTER',
        otp_expires_at: otpExpiryDate(),
        otp_attempts: 0,
      })
      .eq('id', agent.id);

    if (updateError) throw new AppError('Failed to complete registration', 500);

    await brevoClient.sendOtpEmail(agent.email, agent.full_name, code, 'REGISTER');

    return { email: agent.email };
  },

  async resendOtp(email: string) {
    const { data: agent, error } = await supabase
      .from('agent_users')
      .select('id, full_name, email, otp_purpose')
      .eq('email', email)
      .maybeSingle();

    if (error || !agent) throw new AppError('Agent not found', 404);
    if (!agent.otp_purpose) throw new AppError('No pending verification for this account', 400);

    const code = generateOtpCode();
    const codeHash = await hashOtp(code);

    await supabase
      .from('agent_users')
      .update({ otp_code_hash: codeHash, otp_expires_at: otpExpiryDate(), otp_attempts: 0 })
      .eq('id', agent.id);

    await brevoClient.sendOtpEmail(agent.email, agent.full_name, code, agent.otp_purpose as 'REGISTER' | 'RESET_PASSWORD');

    return { email: agent.email };
  },

  async verifyOtp(email: string, code: string) {
    const { data: agent, error } = await supabase
      .from('agent_users')
      .select('id, otp_code_hash, otp_purpose, otp_expires_at, otp_attempts')
      .eq('email', email)
      .maybeSingle();

    if (error || !agent) throw new AppError('Agent not found', 404);
    if (agent.otp_purpose !== 'REGISTER') throw new AppError('No registration verification pending', 400);
    if (!agent.otp_code_hash || isOtpExpired(agent.otp_expires_at)) {
      throw new AppError('OTP has expired, please request a new one', 400);
    }
    if (agent.otp_attempts >= 5) throw new AppError('Too many attempts, request a new OTP', 429);

    const valid = await compareOtp(code, agent.otp_code_hash);
    if (!valid) {
      await supabase.from('agent_users').update({ otp_attempts: agent.otp_attempts + 1 }).eq('id', agent.id);
      throw new AppError('Invalid OTP code', 400);
    }

    await supabase
      .from('agent_users')
      .update({ otp_code_hash: null, otp_purpose: null, otp_expires_at: null, otp_attempts: 0 })
      .eq('id', agent.id);

    return { verified: true };
  },

  async login(email: string, password: string) {
    const { data: agent, error } = await supabase
      .from('agent_users')
      .select('id, full_name, email, password_hash, is_active, agent_code, role, lga, phone')
      .eq('email', email)
      .maybeSingle();

    if (error || !agent) throw new AppError('Invalid email or password', 401);
    if (!agent.is_active) throw new AppError('This account has been disabled', 403);
    if (!agent.password_hash) throw new AppError('Please complete registration first', 403);

    const valid = await comparePassword(password, agent.password_hash);
    if (!valid) throw new AppError('Invalid email or password', 401);

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

  async forgotPassword(email: string) {
    const { data: agent, error } = await supabase
      .from('agent_users')
      .select('id, full_name, email, password_hash, is_active')
      .eq('email', email)
      .maybeSingle();

    if (error || !agent) throw new AppError('No account found for this email', 404);
    if (!agent.is_active) throw new AppError('This account has been disabled', 403);
    if (!agent.password_hash) throw new AppError('Please complete registration first', 403);

    const code = generateOtpCode();
    const codeHash = await hashOtp(code);

    await supabase
      .from('agent_users')
      .update({ otp_code_hash: codeHash, otp_purpose: 'RESET_PASSWORD', otp_expires_at: otpExpiryDate(), otp_attempts: 0 })
      .eq('id', agent.id);

    await brevoClient.sendOtpEmail(agent.email, agent.full_name, code, 'RESET_PASSWORD');

    return { email: agent.email };
  },

  async verifyResetOtp(email: string, code: string) {
    const { data: agent, error } = await supabase
      .from('agent_users')
      .select('id, email, otp_code_hash, otp_purpose, otp_expires_at, otp_attempts')
      .eq('email', email)
      .maybeSingle();

    if (error || !agent) throw new AppError('Agent not found', 404);
    if (agent.otp_purpose !== 'RESET_PASSWORD') throw new AppError('No password reset pending', 400);
    if (!agent.otp_code_hash || isOtpExpired(agent.otp_expires_at)) {
      throw new AppError('OTP has expired, please request a new one', 400);
    }
    if (agent.otp_attempts >= 5) throw new AppError('Too many attempts, request a new OTP', 429);

    const valid = await compareOtp(code, agent.otp_code_hash);
    if (!valid) {
      await supabase.from('agent_users').update({ otp_attempts: agent.otp_attempts + 1 }).eq('id', agent.id);
      throw new AppError('Invalid OTP code', 400);
    }

    await supabase
      .from('agent_users')
      .update({ otp_code_hash: null, otp_purpose: null, otp_expires_at: null, otp_attempts: 0 })
      .eq('id', agent.id);

    const resetToken = signResetToken({ sub: agent.id, email: agent.email });

    return { resetToken };
  },

  async resetPassword(resetToken: string, newPassword: string) {
    let payload;
    try {
      payload = verifyResetToken(resetToken);
    } catch {
      throw new AppError('Invalid or expired reset token', 401);
    }

    const passwordHash = await hashPassword(newPassword);
    const { error } = await supabase.from('agent_users').update({ password_hash: passwordHash }).eq('id', payload.sub);
    if (error) throw new AppError('Failed to reset password', 500);

    return { message: 'Password reset successful' };
  },
};