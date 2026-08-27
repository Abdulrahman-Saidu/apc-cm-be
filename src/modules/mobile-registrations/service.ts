import { supabase } from '@/config/supabase';
import { AppError } from '@/middleware/errorHandler';
import { RegistrationRow, RegistrationStatus } from '@/types/db';
import { reverseGeocode } from '@/utils/geocoding';

type RegistrationInput = {
  fullName: string;
  phone: string;
  email?: string;
  nin?: string;
  bvn?: string;
  eRegNumber?: string;
  vin?: string;
  homeAddress: string;
  state: string;
  lga: string;
  ward?: string;
  accountNumber?: string;
  bankName?: string;
  accountName?: string;
  latitude?: number;
  longitude?: number;
};

function toRow(agentId: string, data: RegistrationInput, locationLabel: string | null) {
  return {
    agent_id: agentId,
    full_name: data.fullName,
    phone: data.phone,
    email: data.email ?? null,
    nin: data.nin ?? null,
    bvn: data.bvn ?? null,
    e_reg_number: data.eRegNumber ?? null,
    vin: data.vin ?? null,
    home_address: data.homeAddress,
    state: data.state,
    lga: data.lga,
    ward: data.ward ?? null,
    account_number: data.accountNumber ?? null,
    bank_name: data.bankName ?? null,
    account_name: data.accountName ?? null,
    latitude: data.latitude ?? null,
    longitude: data.longitude ?? null,
    location_label: locationLabel,
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

async function geocodeIfPresent(data: RegistrationInput): Promise<string | null> {
  if (data.latitude == null || data.longitude == null) return null;
  return reverseGeocode(data.latitude, data.longitude);
}

export const mobileRegistrationsService = {
  async create(agentId: string, data: RegistrationInput) {
    const locationLabel = await geocodeIfPresent(data);

    const { data: row, error } = await supabase
      .from('registrations')
      .insert(toRow(agentId, data, locationLabel))
      .select('id, reg_number, status')
      .single<Pick<RegistrationRow, 'id' | 'reg_number' | 'status'>>();

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

    // Geocode everything in parallel up front — the inserts below still run
    // sequentially (per-record duplicate handling), but there's no reason to
    // pay the geocoding latency serially too.
    const locationLabels = await Promise.all(records.map(geocodeIfPresent));

    for (let i = 0; i < records.length; i++) {
      const { localId, ...data } = records[i];
      const { data: row, error } = await supabase
        .from('registrations')
        .insert(toRow(agentId, data, locationLabels[i]))
        .select('reg_number')
        .single<Pick<RegistrationRow, 'reg_number'>>();

      if (error) {
        results.push({
          localId,
          success: false,
          error: error.code === '23505' ? `Duplicate ${duplicateField(error.message)}` : 'Failed to save',
        });
        continue;
      }

      results.push({ localId, success: true, regNumber: row.reg_number ?? undefined });
    }

    await touchLastSeen(agentId);

    return results;
  },

  async listMine(agentId: string, status: RegistrationStatus | 'all') {
    let query = supabase
      .from('registrations')
      .select('id, reg_number, full_name, phone, home_address, state, lga, email, nin, bvn, e_reg_number, vin, ward, account_number, bank_name, account_name, latitude, longitude, location_label, status, rejection_reason, created_at')
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