import { supabase } from '@/config/supabase';
import { AppError } from '@/middleware/errorHandler';

export type RegistrationInput = {
  fullName: string;
  phone: string;
  homeAddress: string;
  state: string;
  lga: string;
};

type SyncRegistrationInput = RegistrationInput & {
  localId: string;
};

function toRow(agentId: string, data: RegistrationInput) {
  return {
    agent_id: agentId,
    full_name: data.fullName.trim(),
    phone: data.phone.trim(),
    home_address: data.homeAddress.trim(),
    state: data.state.trim(),
    lga: data.lga.trim(),
  };
}

async function touchLastSeen(agentId: string) {
  const { error } = await supabase
    .from('agent_users')
    .update({
      last_seen_at: new Date().toISOString(),
    })
    .eq('id', agentId);

  if (error) {
    console.error('Failed to update agent last seen:', {
      agentId,
      error,
    });
  }
}

export const mobileRegistrationsService = {
  async create(agentId: string, data: RegistrationInput) {
    const { data: row, error } = await supabase
      .from('registrations')
      .insert(toRow(agentId, data))
      .select('id, reg_number, status')
      .single();

    if (error) {
      console.error('Failed to submit registration:', error);

      throw new AppError(
        'Failed to submit registration',
        500
      );
    }

    await touchLastSeen(agentId);

    return row;
  },

  async sync(
    agentId: string,
    records: SyncRegistrationInput[]
  ) {
    const results: {
      localId: string;
      success: boolean;
      registrationId?: string;
      regNumber?: string;
      status?: string;
      error?: string;
    }[] = [];

    for (const record of records) {
      const { localId, ...data } = record;

      const { data: row, error } = await supabase
        .from('registrations')
        .insert(toRow(agentId, data))
        .select('id, reg_number, status')
        .single();

      if (error) {
        console.error('Failed to sync registration:', {
          agentId,
          localId,
          error,
        });

        results.push({
          localId,
          success: false,
          error: 'Failed to save registration',
        });

        continue;
      }

      results.push({
        localId,
        success: true,
        registrationId: row.id,
        regNumber: row.reg_number,
        status: row.status,
      });
    }

    await touchLastSeen(agentId);

    return results;
  },

  async listMine(
    agentId: string,
    status: 'pending' | 'approved' | 'rejected' | 'all'
  ) {
    let query = supabase
      .from('registrations')
      .select(
        `
          id,
          reg_number,
          full_name,
          phone,
          home_address,
          state,
          lga,
          status,
          created_at
        `
      )
      .eq('agent_id', agentId)
      .order('created_at', {
        ascending: false,
      });

    if (status !== 'all') {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Failed to load registrations:', error);

      throw new AppError(
        'Failed to load registrations',
        500
      );
    }

    return data ?? [];
  },

  async myStats(agentId: string) {
    const { count: total, error: totalError } = await supabase
      .from('registrations')
      .select('id', {
        count: 'exact',
        head: true,
      })
      .eq('agent_id', agentId);

    const { count: approved, error: approvedError } =
      await supabase
        .from('registrations')
        .select('id', {
          count: 'exact',
          head: true,
        })
        .eq('agent_id', agentId)
        .eq('status', 'approved');

    if (totalError || approvedError) {
      console.error('Failed to load registration stats:', {
        totalError,
        approvedError,
      });

      throw new AppError(
        'Failed to load stats',
        500
      );
    }

    return {
      total: total ?? 0,
      approved: approved ?? 0,
    };
  },
};