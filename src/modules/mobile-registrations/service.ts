import { supabase } from '@/config/supabase';
import { AppError } from '@/middleware/errorHandler';

export type RegistrationInput = {
  fullName: string;
  phone: string;
  homeAddress: string;
  state: string;
  lga: string;

  email?: string;
  nin?: string;
  bvn?: string;
  eRegNumber?: string;
  vin?: string;
  ward?: string;
  accountNumber?: string;
  bankName?: string;
  accountName?: string;
};

type SyncRegistrationInput = RegistrationInput & {
  localId: string;
};

function toNullable(
  value?: string
): string | null {
  const trimmed = value?.trim();

  return trimmed ? trimmed : null;
}

function toRow(
  agentId: string,
  data: RegistrationInput
) {
  return {
    agent_id: agentId,

    full_name: data.fullName.trim(),

    phone: data.phone.trim(),

    home_address: data.homeAddress.trim(),

    state: data.state.trim(),

    lga: data.lga.trim(),

    email: toNullable(data.email),

    nin: toNullable(data.nin),

    bvn: toNullable(data.bvn),

    e_reg_number: toNullable(
      data.eRegNumber
    ),

    vin: toNullable(data.vin),

    ward: toNullable(data.ward),

    account_number: toNullable(
      data.accountNumber
    ),

    bank_name: toNullable(
      data.bankName
    ),

    account_name: toNullable(
      data.accountName
    ),
  };
}

function duplicateField(
  message: string
): string {
  if (
    message.includes(
      'registrations_nin_key'
    )
  ) {
    return 'NIN';
  }

  if (
    message.includes(
      'registrations_bvn_key'
    )
  ) {
    return 'BVN';
  }

  return 'record';
}

async function touchLastSeen(
  agentId: string
) {
  const { error } = await supabase
    .from('agent_users')
    .update({
      last_seen_at: new Date().toISOString(),
    })
    .eq('id', agentId);

  if (error) {
    console.warn(
      'Failed to update agent last_seen_at',
      error
    );
  }
}

export const mobileRegistrationsService = {
  async create(
    agentId: string,
    data: RegistrationInput
  ) {
    const { data: row, error } =
      await supabase
        .from('registrations')
        .insert(
          toRow(agentId, data)
        )
        .select(
          `
            id,
            reg_number,
            status
          `
        )
        .single();

    if (error) {
      if (error.code === '23505') {
        throw new AppError(
          `A registration with this ${duplicateField(
            error.message
          )} already exists`,
          409
        );
      }

      console.error(
        'Failed to submit registration',
        error
      );

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
      regNumber?: string;
      error?: string;
    }[] = [];

    for (const record of records) {
      const {
        localId,
        ...registration
      } = record;

      const { data: row, error } =
        await supabase
          .from('registrations')
          .insert(
            toRow(
              agentId,
              registration
            )
          )
          .select(
            'reg_number'
          )
          .single();

      if (error) {
        console.warn(
          'Failed to sync registration',
          {
            localId,
            error,
          }
        );

        results.push({
          localId,
          success: false,
          error:
            error.code === '23505'
              ? `Duplicate ${duplicateField(
                  error.message
                )}`
              : 'Failed to save registration',
        });

        continue;
      }

      results.push({
        localId,
        success: true,
        regNumber: row.reg_number,
      });
    }

    await touchLastSeen(agentId);

    return results;
  },

  async listMine(
    agentId: string,
    status:
      | 'pending'
      | 'approved'
      | 'rejected'
      | 'all'
  ) {
    let query = supabase
      .from('registrations')
      .select(
        `
          id,
          reg_number,
          full_name,
          phone,
          email,
          nin,
          bvn,
          e_reg_number,
          vin,
          home_address,
          state,
          lga,
          ward,
          account_number,
          bank_name,
          account_name,
          status,
          created_at
        `
      )
      .eq(
        'agent_id',
        agentId
      )
      .order(
        'created_at',
        {
          ascending: false,
        }
      );

    if (status !== 'all') {
      query = query.eq(
        'status',
        status
      );
    }

    const { data, error } =
      await query;

    if (error) {
      console.error(
        'Failed to load registrations',
        error
      );

      throw new AppError(
        'Failed to load registrations',
        500
      );
    }

    return data;
  },

  async myStats(
    agentId: string
  ) {
    const [
      totalResult,
      approvedResult,
    ] = await Promise.all([
      supabase
        .from('registrations')
        .select(
          'id',
          {
            count: 'exact',
            head: true,
          }
        )
        .eq(
          'agent_id',
          agentId
        ),

      supabase
        .from('registrations')
        .select(
          'id',
          {
            count: 'exact',
            head: true,
          }
        )
        .eq(
          'agent_id',
          agentId
        )
        .eq(
          'status',
          'approved'
        ),
    ]);

    if (
      totalResult.error ||
      approvedResult.error
    ) {
      console.error(
        'Failed to load registration stats',
        {
          totalError:
            totalResult.error,
          approvedError:
            approvedResult.error,
        }
      );

      throw new AppError(
        'Failed to load stats',
        500
      );
    }

    return {
      total:
        totalResult.count ?? 0,

      approved:
        approvedResult.count ?? 0,
    };
  },
};