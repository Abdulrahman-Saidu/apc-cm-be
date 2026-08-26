export type OtpPurpose = 'REGISTER' | 'RESET_PASSWORD';
export type AdminRole = 'super_admin' | 'admin';
export type InviteStatus = 'pending' | 'registered';
export type RegistrationStatus = 'pending' | 'approved' | 'rejected';

export interface AdminUserRow {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  role: AdminRole;
  password_hash: string | null;
  is_verified: boolean;
  invite_token: string | null;
  invite_status: InviteStatus;
  invited_by: string | null;
  invited_at: string | null;
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
  phone: string | null;
  /** Legacy column — no longer written or read anywhere in the app. Kept only because it still exists in the DB. */
  zone: string | null;
  lga: string | null;
  role: string;
  is_active: boolean;
  device_id: string | null;
  bound_at: string | null;
  last_seen_at: string | null;
  otp_code_hash: string | null;
  otp_purpose: OtpPurpose | null;
  otp_expires_at: string | null;
  otp_attempts: number;
  created_at: string;
  updated_at: string;
}

/**
 * Matches the `registrations` table exactly.
 *
 * Only full_name, phone, home_address, state, and lga are required by
 * the app and enforced NOT NULL in the DB. Every other field is
 * genuinely optional end-to-end (mobile form -> Zod schema -> DB column).
 */
export interface RegistrationRow {
  id: string;
  reg_number: string | null;
  full_name: string;
  phone: string;
  email: string | null;
  nin: string | null;
  bvn: string | null;
  e_reg_number: string | null;
  vin: string | null;
  home_address: string;
  state: string;
  lga: string;
  ward: string | null;
  account_number: string | null;
  bank_name: string | null;
  account_name: string | null;
  status: RegistrationStatus;
  rejection_reason: string | null;
  agent_id: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}