import { supabase } from '@/config/supabase';
import { AppError } from '@/middleware/errorHandler';
import { RegistrationRow, RegistrationStatus } from '@/types/db';

const ACTIVE_WINDOW_MS = 24 * 60 * 60 * 1000; // "active" = synced in the last 24h

type Pagination = { page: number; pageSize: number };

type AgentJoin = { full_name: string; agent_code: string } | null;

type RecentActivityRow = Pick<RegistrationRow, 'id' | 'reg_number' | 'full_name' | 'status' | 'created_at' | 'reviewed_at'> & {
    agent: AgentJoin;
};

type QueueRow = Pick<
    RegistrationRow,
    'id' | 'reg_number' | 'full_name' | 'phone' | 'nin' | 'bvn' | 'home_address' | 'state' | 'lga' | 'ward' | 'status' | 'rejection_reason' | 'created_at' | 'reviewed_at'
> & { agent: AgentJoin };

type RegistryRow = Pick<
    RegistrationRow,
    'id' | 'reg_number' | 'full_name' | 'phone' | 'email' | 'home_address' | 'state' | 'lga' | 'ward' | 'account_number' | 'bank_name' | 'account_name' | 'created_at'
> & { agent: AgentJoin };

type RegistryExportRow = Pick<
    RegistrationRow,
    'reg_number' | 'full_name' | 'phone' | 'email' | 'home_address' | 'state' | 'lga' | 'ward' | 'account_number' | 'bank_name' | 'account_name' | 'created_at'
> & { agent: AgentJoin };

type AgentListRow = {
    id: string;
    agent_code: string;
    full_name: string;
    role: string;
    lga: string | null;
    device_id: string | null;
    is_active: boolean;
    last_seen_at: string | null;
};

function startOfDay(d: Date) {
    const copy = new Date(d);
    copy.setHours(0, 0, 0, 0);
    return copy;
}

function csvEscape(value: unknown): string {
    let str = value === null || value === undefined ? '' : String(value);

    // neutralize formula injection — Excel/Sheets treats leading =,+,-,@ as a formula
    if (/^[=+\-@]/.test(str)) str = `'${str}`;

    if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
    return str;
}

function pageRange({ page, pageSize }: Pagination): [number, number] {
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    return [from, to];
}

export const dashboardOpsService = {
    async getOverview() {
        const now = new Date();
        const sevenDaysAgo = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
        const activeSince = new Date(now.getTime() - ACTIVE_WINDOW_MS).toISOString();

        const [{ count: total }, { count: pending }, { count: activeAgents }, { data: last7DaysRows, error: trendError }, { data: recentRows, error: recentError }] =
            await Promise.all([
                supabase.from('registrations').select('id', { count: 'exact', head: true }),
                supabase.from('registrations').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
                supabase.from('agent_users').select('id', { count: 'exact', head: true }).gte('last_seen_at', activeSince),
                supabase
                    .from('registrations')
                    .select('created_at')
                    .gte('created_at', startOfDay(sevenDaysAgo).toISOString())
                    .returns<Pick<RegistrationRow, 'created_at'>[]>(),
                supabase
                    .from('registrations')
                    .select('id, reg_number, full_name, status, created_at, reviewed_at, agent:agent_users(full_name, agent_code)')
                    .order('created_at', { ascending: false })
                    .limit(10)
                    .returns<RecentActivityRow[]>(),
            ]);

        if (trendError || recentError) throw new AppError('Failed to load overview', 500);

        const dailyCounts: { date: string; count: number }[] = [];
        for (let i = 6; i >= 0; i--) {
            const day = startOfDay(new Date(now.getTime() - i * 24 * 60 * 60 * 1000));
            const dateStr = day.toISOString().slice(0, 10);
            const count = (last7DaysRows ?? []).filter((r) => r.created_at.slice(0, 10) === dateStr).length;
            dailyCounts.push({ date: dateStr, count });
        }

        const todayStr = startOfDay(now).toISOString().slice(0, 10);
        const dailyVelocity = dailyCounts.find((d) => d.date === todayStr)?.count ?? 0;

        return {
            totalRegistrations: total ?? 0,
            pendingRegistrations: pending ?? 0,
            activeAgents: activeAgents ?? 0,
            dailyVelocity,
            dailyCounts,
            recentActivity: recentRows,
        };
    },

    async listAgents(pagination: Pagination) {
        const [from, to] = pageRange(pagination);

        const { data: agents, error, count } = await supabase
            .from('agent_users')
            .select('id, agent_code, full_name, role, lga, device_id, is_active, last_seen_at', { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(from, to)
            .returns<AgentListRow[]>();

        if (error) throw new AppError('Failed to load agents', 500);

        const ids = (agents ?? []).map((a) => a.id);
        const { data: regCounts, error: countError } = ids.length
            ? await supabase.from('registrations').select('agent_id').in('agent_id', ids).returns<Pick<RegistrationRow, 'agent_id'>[]>()
            : { data: [] as Pick<RegistrationRow, 'agent_id'>[], error: null };
        if (countError) throw new AppError('Failed to load agent stats', 500);

        const countMap = new Map<string, number>();
        for (const row of regCounts ?? []) {
            countMap.set(row.agent_id, (countMap.get(row.agent_id) ?? 0) + 1);
        }

        return {
            data: (agents ?? []).map((a) => ({
                id: a.id,
                agentCode: a.agent_code,
                fullName: a.full_name,
                role: a.role,
                lga: a.lga,
                deviceId: a.device_id,
                registrations: countMap.get(a.id) ?? 0,
                lastSeen: a.last_seen_at,
                status: a.is_active ? 'active' : 'deactivated',
            })),
            pagination: { page: pagination.page, pageSize: pagination.pageSize, total: count ?? 0 },
        };
    },

    async activateAgent(id: string) {
        const { error } = await supabase.from('agent_users').update({ is_active: true }).eq('id', id);
        if (error) throw new AppError('Failed to activate agent', 500);
        return { id, status: 'active' };
    },

    async deactivateAgent(id: string) {
        const { error } = await supabase.from('agent_users').update({ is_active: false }).eq('id', id);
        if (error) throw new AppError('Failed to deactivate agent', 500);
        return { id, status: 'deactivated' };
    },

    async resetAgentDevice(id: string) {
        const { data, error } = await supabase
            .from('agent_users')
            .update({ device_id: null, bound_at: null })
            .eq('id', id)
            .select('id')
            .maybeSingle();

        if (error) throw new AppError('Failed to reset device binding', 500);
        if (!data) throw new AppError('Agent not found', 404);

        return { id, deviceReset: true };
    },

    async listQueue(status: RegistrationStatus | 'all', pagination: Pagination) {
        const [from, to] = pageRange(pagination);

        // NOTE: .returns<T[]>() is applied only at the final await, after every
        // conditional filter — calling it earlier collapses the query into a
        // PostgrestTransformBuilder, which no longer exposes .eq()/.ilike()/etc.
        let query = supabase
            .from('registrations')
            .select(
                'id, reg_number, full_name, phone, nin, bvn, home_address, state, lga, ward, status, rejection_reason, created_at, reviewed_at, agent:agent_users(full_name, agent_code)',
                { count: 'exact' }
            )
            .order('created_at', { ascending: false })
            .range(from, to);

        if (status !== 'all') query = query.eq('status', status);

        const { data, error, count } = await query.returns<QueueRow[]>();
        if (error) throw new AppError('Failed to load queue', 500);

        return { data, pagination: { page: pagination.page, pageSize: pagination.pageSize, total: count ?? 0 } };
    },

    async approve(id: string, adminId: string) {
        const { data, error } = await supabase
            .from('registrations')
            .update({ status: 'approved', reviewed_by: adminId, reviewed_at: new Date().toISOString() })
            .eq('id', id)
            .eq('status', 'pending')
            .select('id')
            .maybeSingle();

        if (error) throw new AppError('Failed to approve registration', 500);
        if (!data) throw new AppError('Registration not found or already reviewed', 409);

        return { id, status: 'approved' };
    },

    async reject(id: string, adminId: string, reason: string) {
        const { data, error } = await supabase
            .from('registrations')
            .update({ status: 'rejected', rejection_reason: reason, reviewed_by: adminId, reviewed_at: new Date().toISOString() })
            .eq('id', id)
            .eq('status', 'pending')
            .select('id')
            .maybeSingle();

        if (error) throw new AppError('Failed to reject registration', 500);
        if (!data) throw new AppError('Registration not found or already reviewed', 409);

        return { id, status: 'rejected', reason };
    },

    async listRegistry(filters: { homeAddress?: string; state?: string; lga?: string }, pagination: Pagination) {
        const [from, to] = pageRange(pagination);

        let query = supabase
            .from('registrations')
            .select(
                'id, reg_number, full_name, phone, email, home_address, state, lga, ward, account_number, bank_name, account_name, created_at, agent:agent_users(full_name, agent_code)',
                { count: 'exact' }
            )
            .eq('status', 'approved')
            .order('created_at', { ascending: false })
            .range(from, to);

        if (filters.homeAddress) query = query.ilike('home_address', `%${filters.homeAddress}%`);
        if (filters.state) query = query.eq('state', filters.state);
        if (filters.lga) query = query.eq('lga', filters.lga);

        const { data, error, count } = await query.returns<RegistryRow[]>();
        if (error) throw new AppError('Failed to load registry', 500);

        return { data, pagination: { page: pagination.page, pageSize: pagination.pageSize, total: count ?? 0 } };
    },

    // CSV export intentionally ignores pagination — it must return the full filtered set,
    // not just one page, so it queries without .range().
    async exportRegistryCsv(filters: { homeAddress?: string; state?: string; lga?: string }): Promise<string> {
        let query = supabase
            .from('registrations')
            .select('reg_number, full_name, phone, email, home_address, state, lga, ward, account_number, bank_name, account_name, created_at, agent:agent_users(full_name, agent_code)')
            .eq('status', 'approved')
            .order('created_at', { ascending: false });

        if (filters.homeAddress) query = query.ilike('home_address', `%${filters.homeAddress}%`);
        if (filters.state) query = query.eq('state', filters.state);
        if (filters.lga) query = query.eq('lga', filters.lga);

        const { data: rows, error } = await query.returns<RegistryExportRow[]>();
        if (error) throw new AppError('Failed to load registry', 500);

        const headers = ['Reg Number', 'Full Name', 'Phone', 'Email', 'Home Address', 'State', 'LGA', 'Ward', 'Account Number', 'Bank Name', 'Account Name', 'Agent', 'Registered At'];
        const lines = [headers.join(',')];

        for (const r of rows ?? []) {
            lines.push(
                [
                    r.reg_number,
                    r.full_name,
                    r.phone,
                    r.email,
                    r.home_address,
                    r.state,
                    r.lga,
                    r.ward,
                    r.account_number,
                    r.bank_name,
                    r.account_name,
                    r.agent?.full_name ?? '',
                    r.created_at,
                ]
                    .map(csvEscape)
                    .join(',')
            );
        }

        return lines.join('\n');
    },
};