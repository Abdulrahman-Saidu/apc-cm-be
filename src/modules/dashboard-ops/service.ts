import { supabase } from '@/config/supabase';
import { AppError, isInvalidIdError } from '@/middleware/errorHandler';
import { forgetAgentStatus } from '@/middleware/requireAuth';
import { LiveEvent, realtime } from '@/realtime/socket';

const ACTIVE_WINDOW_MS = 24 * 60 * 60 * 1000; // "active" = synced in the last 24h
const DAY_MS = 24 * 60 * 60 * 1000;
// Nigeria is UTC+1 all year (no daylight saving), so days start at 00:00 Lagos time.
const LAGOS_OFFSET_MS = 60 * 60 * 1000;
// Supabase returns at most 1000 rows per request; bigger reads are fetched in pages.
const FETCH_PAGE_SIZE = 1000;

type Pagination = { page: number; pageSize: number };
type RegistryFilters = { homeAddress?: string; state?: string; lga?: string };

/** Start of the Lagos calendar day containing `ms`, as a UTC timestamp. */
function lagosDayStart(ms: number): number {
    return Math.floor((ms + LAGOS_OFFSET_MS) / DAY_MS) * DAY_MS - LAGOS_OFFSET_MS;
}

/** YYYY-MM-DD of a Lagos day start. */
function lagosDateLabel(dayStartMs: number): string {
    return new Date(dayStartMs + LAGOS_OFFSET_MS).toISOString().slice(0, 10);
}

/** Escapes % and _ so search text is matched literally inside ILIKE. */
function likePattern(text: string): string {
    return `%${text.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
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
        const now = Date.now();
        const todayStart = lagosDayStart(now);
        const activeSince = new Date(now - ACTIVE_WINDOW_MS).toISOString();

        // One count per day for the last 7 Lagos days. Counting in the
        // database stays correct at any volume (row reads cap at 1000).
        const dayStarts = Array.from({ length: 7 }, (_, k) => todayStart - (6 - k) * DAY_MS);
        const dayCountQueries = dayStarts.map((start) =>
            supabase
                .from('registrations')
                .select('id', { count: 'exact', head: true })
                .gte('created_at', new Date(start).toISOString())
                .lt('created_at', new Date(start + DAY_MS).toISOString())
        );

        const [totalRes, pendingRes, activeRes, recentRes, ...dayRes] = await Promise.all([
            supabase.from('registrations').select('id', { count: 'exact', head: true }),
            supabase.from('registrations').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
            supabase.from('agent_users').select('id', { count: 'exact', head: true }).gte('last_seen_at', activeSince),
            supabase
                .from('registrations')
                .select('id, reg_number, full_name, status, created_at, reviewed_at, agent:agent_users(full_name, agent_code)')
                .order('created_at', { ascending: false })
                .limit(10),
            ...dayCountQueries,
        ]);

        if ([totalRes, pendingRes, activeRes, recentRes, ...dayRes].some((r) => r.error)) {
            throw new AppError('Failed to load overview', 500);
        }

        const dailyCounts = dayStarts.map((start, k) => ({
            date: lagosDateLabel(start),
            count: dayRes[k].count ?? 0,
        }));

        return {
            totalRegistrations: totalRes.count ?? 0,
            pendingRegistrations: pendingRes.count ?? 0,
            activeAgents: activeRes.count ?? 0,
            dailyVelocity: dailyCounts[dailyCounts.length - 1].count,
            dailyCounts,
            recentActivity: recentRes.data,
        };
    },

    async listAgents(pagination: Pagination) {
        const [from, to] = pageRange(pagination);

        const { data: agents, error, count } = await supabase
            .from('agent_users')
            .select('id, agent_code, full_name, role, lga, phone, is_active, last_seen_at', { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(from, to);

        if (error) throw new AppError('Failed to load agents', 500);

        // Count in the database, one small query per agent on this page
        // (at most 100). Reading rows to count them stops at 1000 rows.
        const counts = await Promise.all(
            (agents ?? []).map((a) =>
                supabase.from('registrations').select('id', { count: 'exact', head: true }).eq('agent_id', a.id)
            )
        );
        if (counts.some((c) => c.error)) throw new AppError('Failed to load agent stats', 500);

        const countMap = new Map<string, number>();
        (agents ?? []).forEach((a, k) => countMap.set(a.id, counts[k].count ?? 0));

        return {
            data: (agents ?? []).map((a) => ({
                id: a.id,
                agentCode: a.agent_code,
                fullName: a.full_name,
                role: a.role,
                lga: a.lga,
                phone: a.phone,
                registrations: countMap.get(a.id) ?? 0,
                lastSeen: a.last_seen_at,
                status: a.is_active ? 'active' : 'deactivated',
            })),
            pagination: { page: pagination.page, pageSize: pagination.pageSize, total: count ?? 0 },
        };
    },

    async activateAgent(id: string) {
        return setAgentActive(id, true);
    },

    async deactivateAgent(id: string) {
        return setAgentActive(id, false);
    },

    async updateAgentPhone(id: string, phone: string) {
        const { data, error } = await supabase
            .from('agent_users')
            .update({ phone })
            .eq('id', id)
            .select('id, phone')
            .maybeSingle();

        if (error && !isInvalidIdError(error)) throw new AppError('Failed to update agent', 500);
        if (!data) throw new AppError('Agent not found', 404);

        realtime.toAdmins(LiveEvent.AgentsChanged, { id: data.id });
        return { id: data.id, phone: data.phone };
    },

    async listQueue(status: 'pending' | 'approved' | 'rejected' | 'all', pagination: Pagination) {
        const [from, to] = pageRange(pagination);

        let query = supabase
            .from('registrations')
            .select(
                'id, reg_number, full_name, phone, email, nin, bvn, e_reg_number, vin, home_address, state, lga, ward, account_number, bank_name, account_name, latitude, longitude, location_label, status, rejection_reason, created_at, reviewed_at, agent:agent_users(full_name, agent_code)',
                { count: 'exact' }
            )
            .order('created_at', { ascending: false })
            .range(from, to);

        if (status !== 'all') query = query.eq('status', status);

        const { data, error, count } = await query;
        if (error) throw new AppError('Failed to load queue', 500);

        return { data, pagination: { page: pagination.page, pageSize: pagination.pageSize, total: count ?? 0 } };
    },

    async approve(id: string, adminId: string) {
        const { data, error } = await supabase
            .from('registrations')
            .update({ status: 'approved', reviewed_by: adminId, reviewed_at: new Date().toISOString() })
            .eq('id', id)
            .eq('status', 'pending')
            .select('id, agent_id, reg_number, full_name')
            .maybeSingle();

        if (error && !isInvalidIdError(error)) throw new AppError('Failed to approve registration', 500);
        if (!data) throw new AppError('Registration not found or already reviewed', 409);

        announceReview(data, 'approved');

        return { id, status: 'approved' };
    },

    async reject(id: string, adminId: string, reason: string) {
        const { data, error } = await supabase
            .from('registrations')
            .update({ status: 'rejected', rejection_reason: reason, reviewed_by: adminId, reviewed_at: new Date().toISOString() })
            .eq('id', id)
            .eq('status', 'pending')
            .select('id, agent_id, reg_number, full_name')
            .maybeSingle();

        if (error && !isInvalidIdError(error)) throw new AppError('Failed to reject registration', 500);
        if (!data) throw new AppError('Registration not found or already reviewed', 409);

        announceReview(data, 'rejected', reason);

        return { id, status: 'rejected', reason };
    },

    async listRegistry(filters: RegistryFilters, pagination: Pagination) {
        const [from, to] = pageRange(pagination);

        let query = supabase
            .from('registrations')
            .select(
                'id, reg_number, full_name, phone, email, nin, bvn, e_reg_number, vin, home_address, state, lga, ward, account_number, bank_name, account_name, latitude, longitude, location_label, created_at, agent:agent_users(full_name, agent_code)',
                { count: 'exact' }
            )
            .eq('status', 'approved')
            .order('created_at', { ascending: false })
            .range(from, to);

        if (filters.homeAddress) query = query.ilike('home_address', likePattern(filters.homeAddress));
        if (filters.state) query = query.eq('state', filters.state);
        if (filters.lga) query = query.eq('lga', filters.lga);

        const { data, error, count } = await query;
        if (error) throw new AppError('Failed to load registry', 500);

        return { data, pagination: { page: pagination.page, pageSize: pagination.pageSize, total: count ?? 0 } };
    },

    // CSV export intentionally ignores pagination — it must return the full filtered set,
    // not just one page, so it queries without .range().
    async exportRegistryCsv(filters: RegistryFilters): Promise<string> {
        const rows: any[] = [];

        // Read the full filtered set in pages of 1000 (the per-request row
        // cap), so large exports are complete instead of silently cut off.
        for (let from = 0; ; from += FETCH_PAGE_SIZE) {
            let query = supabase
                .from('registrations')
                .select('reg_number, full_name, phone, email, nin, bvn, e_reg_number, vin, home_address, state, lga, ward, account_number, bank_name, account_name, latitude, longitude, location_label, created_at, agent:agent_users(full_name, agent_code)')
                .eq('status', 'approved')
                .order('created_at', { ascending: false })
                .order('id', { ascending: false }) // stable order across pages
                .range(from, from + FETCH_PAGE_SIZE - 1);

            if (filters.homeAddress) query = query.ilike('home_address', likePattern(filters.homeAddress));
            if (filters.state) query = query.eq('state', filters.state);
            if (filters.lga) query = query.eq('lga', filters.lga);

            const { data, error } = await query;
            if (error) throw new AppError('Failed to load registry', 500);

            rows.push(...(data ?? []));
            if (!data || data.length < FETCH_PAGE_SIZE) break;
        }

        const headers = ['Reg Number', 'Full Name', 'Phone', 'Email', 'NIN', 'BVN', 'E-Reg Number', 'VIN', 'Home Address', 'State', 'LGA', 'Ward', 'Account Number', 'Bank Name', 'Account Name', 'Latitude', 'Longitude', 'Location', 'Agent', 'Registered At'];
        const lines = [headers.join(',')];

        for (const r of rows) {
            lines.push(
                [
                    r.reg_number,
                    r.full_name,
                    r.phone,
                    r.email,
                    r.nin,
                    r.bvn,
                    r.e_reg_number,
                    r.vin,
                    r.home_address,
                    r.state,
                    r.lga,
                    r.ward,
                    r.account_number,
                    r.bank_name,
                    r.account_name,
                    r.latitude,
                    r.longitude,
                    r.location_label,
                    r.agent?.full_name ?? '',
                    r.created_at,
                ]
                    .map(csvEscape)
                    .join(',')
            );
        }

        // BOM so Excel opens names with accents/special characters correctly.
        return '\uFEFF' + lines.join('\r\n');
    },
};

async function setAgentActive(id: string, active: boolean) {
    const { data, error } = await supabase
        .from('agent_users')
        .update({ is_active: active })
        .eq('id', id)
        .select('id')
        .maybeSingle();

    if (error && !isInvalidIdError(error)) {
        throw new AppError(active ? 'Failed to activate agent' : 'Failed to deactivate agent', 500);
    }
    if (!data) throw new AppError('Agent not found', 404);

    // Takes effect on the agent's very next request, not after the cache expires.
    forgetAgentStatus(id);

    realtime.toAdmins(LiveEvent.AgentsChanged, { id });
    // A deactivated agent is signed out on every device that is online now.
    if (!active) realtime.signOutAgent(id);

    return { id, status: active ? 'active' : 'deactivated' };
}

type ReviewedRow = { id: string; agent_id: string | null; reg_number: string | null; full_name: string | null };

function announceReview(row: ReviewedRow, status: 'approved' | 'rejected', reason?: string) {
    const payload = {
        id: row.id,
        regNumber: row.reg_number,
        fullName: row.full_name,
        status,
        ...(reason ? { reason } : {}),
    };
    realtime.toAdmins(LiveEvent.RegistrationReviewed, payload);
    if (row.agent_id) realtime.toAgent(row.agent_id, LiveEvent.RegistrationReviewed, payload);
}