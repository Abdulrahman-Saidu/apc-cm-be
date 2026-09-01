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

// Partial-update variant of toRow: only includes keys actually present in the
// payload, so a partial PATCH (e.g. just `phone`) never nulls out fields the
// agent didn't touch. This is the key difference from create's toRow(), which
// always writes every optional field (defaulting to null) because create
// always receives the full form.
function toUpdateRow(data: Partial<RegistrationInput>, locationLabel: string | null | undefined) {
  const row: Record<string, unknown> = {};
  if (data.fullName !== undefined) row.full_name = data.fullName;
  if (data.phone !== undefined) row.phone = data.phone;
  if (data.email !== undefined) row.email = data.email;
  if (data.nin !== undefined) row.nin = data.nin;
  if (data.bvn !== undefined) row.bvn = data.bvn;
  if (data.eRegNumber !== undefined) row.e_reg_number = data.eRegNumber;
  if (data.vin !== undefined) row.vin = data.vin;
  if (data.homeAddress !== undefined) row.home_address = data.homeAddress;
  if (data.state !== undefined) row.state = data.state;
  if (data.lga !== undefined) row.lga = data.lga;
  if (data.ward !== undefined) row.ward = data.ward;
  if (data.accountNumber !== undefined) row.account_number = data.accountNumber;
  if (data.bankName !== undefined) row.bank_name = data.bankName;
  if (data.accountName !== undefined) row.account_name = data.accountName;
  if (data.latitude !== undefined) row.latitude = data.latitude;
  if (data.longitude !== undefined) row.longitude = data.longitude;
  if (locationLabel !== undefined) row.location_label = locationLabel;
  return row;
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

// Update-specific: only recompute location_label if BOTH coords were sent in
// this particular PATCH. `undefined` (as opposed to `null`) means "leave
// location_label alone" — toUpdateRow only writes the key when this returns
// something other than undefined.
async function geocodeForUpdate(data: Partial<RegistrationInput>): Promise<string | null | undefined> {
  if (data.latitude === undefined || data.longitude === undefined) return undefined;
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

  async update(agentId: string, id: string, data: Partial<RegistrationInput>) {
    const locationLabel = await geocodeForUpdate(data);
    const patch = toUpdateRow(data, locationLabel);

    const { data: rows, error } = await supabase
      .from('registrations')
      .update(patch)
      .eq('id', id)
      .eq('agent_id', agentId)
      .eq('status', 'pending')
      .select('id, reg_number, status');

    if (error) {
      if (error.code === '23505') {
        throw new AppError(`A registration with this ${duplicateField(error.message)} already exists`, 409);
      }
      throw new AppError('Failed to update registration', 500);
    }

    // Supabase doesn't error on zero matched rows for an update — it just
    // returns []. That's exactly the "not this agent's record, or no longer
    // pending" case, so we turn it into an explicit 409 here rather than
    // letting it look like a silent no-op success.
    if (!rows || rows.length === 0) {
      throw new AppError('This registration is no longer editable', 409);
    }

    await touchLastSeen(agentId);

    return rows[0];
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