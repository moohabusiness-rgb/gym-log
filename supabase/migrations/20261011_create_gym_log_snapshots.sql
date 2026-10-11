-- Gym Log: one private cloud-backup snapshot per authenticated user.
-- Run this migration only in your own Supabase project.
-- The published GitHub Pages app will use an anon/publishable key, NEVER a service-role key.

create table if not exists public.gym_log_snapshots (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null,
  revision bigint not null default 1 check (revision > 0),
  updated_at timestamptz not null default now(),
  constraint gym_log_snapshot_is_object check (jsonb_typeof(data) = 'object')
);

create or replace function public.gym_log_stamp_snapshot()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  if tg_op = 'UPDATE' then
    new.revision = old.revision + 1;
  end if;
  return new;
end;
$$;

drop trigger if exists gym_log_stamp_snapshot_trigger on public.gym_log_snapshots;
create trigger gym_log_stamp_snapshot_trigger
before insert or update on public.gym_log_snapshots
for each row execute function public.gym_log_stamp_snapshot();

alter table public.gym_log_snapshots enable row level security;

drop policy if exists gym_log_select_own on public.gym_log_snapshots;
create policy gym_log_select_own
on public.gym_log_snapshots
for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists gym_log_insert_own on public.gym_log_snapshots;
create policy gym_log_insert_own
on public.gym_log_snapshots
for insert to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists gym_log_update_own on public.gym_log_snapshots;
create policy gym_log_update_own
on public.gym_log_snapshots
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists gym_log_delete_own on public.gym_log_snapshots;
create policy gym_log_delete_own
on public.gym_log_snapshots
for delete to authenticated
using ((select auth.uid()) = user_id);

revoke all on public.gym_log_snapshots from anon;
grant select, insert, update, delete on public.gym_log_snapshots to authenticated;

comment on table public.gym_log_snapshots is
  'Private Gym Log JSON backups for signed-in users only; row-level security enforces per-user isolation.';
