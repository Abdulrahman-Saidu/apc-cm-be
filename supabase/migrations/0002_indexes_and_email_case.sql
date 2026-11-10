-- Baba Isa Vanguard: indexes for the API's most frequent queries, and
-- lowercase emails to match how the API now looks them up.
-- Run in the Supabase SQL editor. Safe to re-run.

-- ---------------------------------------------------------------------------
-- 1. Indexes (no data changes)
-- ---------------------------------------------------------------------------

-- An agent's own list and stats (mobile app Home and Queue).
create index if not exists registrations_agent_created_idx
  on public.registrations (agent_id, created_at desc);

-- Dashboard queue, registry and export (filtered by status, newest first).
create index if not exists registrations_status_created_idx
  on public.registrations (status, created_at desc);

-- Dashboard overview: daily counts.
create index if not exists registrations_created_idx
  on public.registrations (created_at);

-- Dashboard overview: active agents in the last 24 hours.
create index if not exists agent_users_last_seen_idx
  on public.agent_users (last_seen_at);

-- Download links: revoking older pending links for an email.
create index if not exists apk_download_invites_email_status_idx
  on public.apk_download_invites (email, status);

-- ---------------------------------------------------------------------------
-- 2. Lowercase emails
--
-- The API now lowercases every email it receives. Accounts saved with
-- capital letters (e.g. Musa@Gmail.com) would no longer be found, so
-- convert them. First check for clashes: two rows that differ only by case
-- would violate the unique email constraint.
-- ---------------------------------------------------------------------------

-- 2a. Must return no rows before running 2b. If it returns rows, decide
--     which account to keep, fix or remove the other, then continue.
select 'agent_users' as table_name, lower(trim(email)) as email, count(*) as rows
from public.agent_users group by lower(trim(email)) having count(*) > 1
union all
select 'admin_users', lower(trim(email)), count(*)
from public.admin_users group by lower(trim(email)) having count(*) > 1;

-- 2b. Lowercase the emails.
update public.agent_users set email = lower(trim(email)) where email <> lower(trim(email));
update public.admin_users set email = lower(trim(email)) where email <> lower(trim(email));
update public.apk_download_invites set email = lower(trim(email)) where email <> lower(trim(email));
