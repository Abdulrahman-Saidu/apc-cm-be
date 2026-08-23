export type OtpPurpose = 'REGISTER' | 'RESET_PASSWORD';

export interface AdminUserRow {
  id: string;
  email: string;
  full_name: string;
  password_hash: string | null;
  is_verified: boolean;
  otp_code_hash: string | null;
  otp_purpose: OtpPurpose | null;
  otp_expires_at: string | null;
  otp_attempts: number;
  created_at: string;
  updated_at: string;
}

export interface AgentUserRow {
  id: string;
  agent_code: string;
  email: string;
  full_name: string;
  password_hash: string | null;
  zone: string | null;
  is_active: boolean;
  device_id: string | null;
  bound_at: string | null;
  otp_code_hash: string | null;
  otp_purpose: OtpPurpose | null;
  otp_expires_at: string | null;
  otp_attempts: number;
  created_at: string;
  updated_at: string;
}