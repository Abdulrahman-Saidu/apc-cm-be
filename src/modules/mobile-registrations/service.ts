import { supabase } from '@/config/supabase';
import { AppError } from '@/middleware/errorHandler';

type RegistrationInput = {
  fullName: string;
  phone: string;
  email?: string;
  nin: string;
  bvn: string;
  eRegNumber?: string;
  vin?: string;
  homeAddress: string;
  state: string;
  lga: string;
  ward: string;
  accountNumber: string;
  bankName: string;
  accountName: string;
};

function toRow(agentId: string, data: RegistrationInput) {
  return {
    agent_id: agentId,
    full_name: data.fullName,
    phone: data.phone,
    email: data.email ?? null,
    nin: data.nin,
    bvn: data.bvn,
    e_reg_number: data.eRegNumber ?? null,
    vin: data.vin ?? null,
    home_address: data.homeAddress,
    state: data.state,
    lga: data.lga,
    ward: data.ward,
    account_number: data.accountNumber,
    bank_name: data.bankName,
    account_name: data.accountName,
  };
}

function duplicateField(message: string): string {
  if (message.includes('registrations_nin_key')) return 'NIN';
  if (message.includes('registrations_bvn_key')) return 'BVN';
  return 'record';
}

async function touchLastSeen(agentId: string) {
  await supabase.from('agent_users').update({ last_seen_at: new Date().toISOString() }).eq('id', agentId);
}

export const mobileRegistrationsService = {
  async create(agentId: string, data: RegistrationInput) {
    const { data: row, error } = await supabase
      .from('registrations')
      .insert(toRow(agentId, data))
      .select('id, reg_number, status')
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new AppError(`A registration with this ${duplicateField(error.message)} already exists`, 409);
      }
      throw new AppError('Failed to submit registration', 500);
    }

    await touchLastSeen(agentId);

    return row;
  },

  async sync(agentId: string, records: (RegistrationInput & { localId: string })[]) {
    const results: { localId: string; success: boolean; regNumber?: string; error?: string }[] = [];

    for (const record of records) {
      const { localId, ...data } = record;
      const { data: row, error } = await supabase
        .from('registrations')
        .insert(toRow(agentId, data))
        .select('reg_number')
        .single();

      if (error) {
        results.push({
          localId,
          success: false,
          error: error.code === '23505' ? `Duplicate ${duplicateField(error.message)}` : 'Failed to save',
        });
        continue;
      }

      results.push({ localId, success: true, regNumber: row.reg_number });
    }

    await touchLastSeen(agentId);

    return results;
  },

  async listMine(agentId: string, status: 'pending' | 'approved' | 'rejected' | 'all') {
    let query = supabase
      .from('registrations')
      .select(
        'id, reg_number, full_name, phone, email, home_address, state, lga, ward, status, created_at'
      )
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false });

    if (status !== 'all') query = query.eq('status', status);

    const { data, error } = await query;
    if (error) throw new AppError('Failed to load registrations', 500);

    return data;
  },

  async myStats(agentId: string) {
    const { count: total, error: totalError } = await supabase
      .from('registrations')
      .select('id', { count: 'exact', head: true })
      .eq('agent_id', agentId);

    const { count: approved, error: approvedError } = await supabase
      .from('registrations')
      .select('id', { count: 'exact', head: true })
      .eq('agent_id', agentId)
      .eq('status', 'approved');

    if (totalError || approvedError) throw new AppError('Failed to load stats', 500);

    return { total: total ?? 0, approved: approved ?? 0 };
  },
};