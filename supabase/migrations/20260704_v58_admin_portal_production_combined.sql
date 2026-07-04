-- Version 5.8 production admin portal combined setup
-- Safe to run multiple times.
-- Combines admin_users table creation/fixes, owner bootstrap, status column,
-- RLS policies, and owner-only admin account management rules.

begin;

create extension if not exists pgcrypto;

create table if not exists public.admin_users (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null unique,
  role text not null default 'admin',
  status text not null default 'active',
  created_at timestamptz not null default now()
);

alter table if exists public.admin_users
  add column if not exists full_name text,
  add column if not exists email text,
  add column if not exists role text default 'admin',
  add column if not exists status text default 'active',
  add column if not exists created_at timestamptz default now();

alter table if exists public.admin_users
  alter column role set default 'admin';

alter table if exists public.admin_users
  alter column status set default 'active';

update public.admin_users
set role = coalesce(nullif(role, ''), 'admin'),
    status = coalesce(nullif(status, ''), 'active')
where role is null or role = '' or status is null or status = '';

create unique index if not exists idx_admin_users_email on public.admin_users(lower(email));
create index if not exists idx_admin_users_role on public.admin_users(role);
create index if not exists idx_admin_users_status on public.admin_users(status);
create index if not exists idx_admin_users_created_at on public.admin_users(created_at desc);

create or replace function public.is_admin_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_users a
    where a.id = auth.uid()
      and a.role = 'super_admin'
      and lower(a.email) in ('james@caqualitysolutions.com', 'alexisbright@caqualitysolutions.com')
      and coalesce(lower(a.status), 'active') = 'active'
  );
$$;

create or replace function public.is_any_admin_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_users a
    where a.id = auth.uid()
      and a.role in ('admin', 'dispatcher', 'super_admin')
      and coalesce(lower(a.status), 'active') = 'active'
  );
$$;

alter table public.admin_users enable row level security;

grant select, insert, update on public.admin_users to authenticated;
grant execute on function public.is_admin_owner() to authenticated;
grant execute on function public.is_any_admin_user() to authenticated;

drop policy if exists admin_users_self_select on public.admin_users;
drop policy if exists admin_users_owner_select_all on public.admin_users;
drop policy if exists admin_users_owner_insert on public.admin_users;
drop policy if exists admin_users_owner_update on public.admin_users;

create policy admin_users_self_select
on public.admin_users
for select
to authenticated
using (id = auth.uid());

create policy admin_users_owner_select_all
on public.admin_users
for select
to authenticated
using (public.is_admin_owner());

create policy admin_users_owner_insert
on public.admin_users
for insert
to authenticated
with check (
  public.is_admin_owner()
  and role in ('admin', 'dispatcher', 'super_admin')
  and status in ('active', 'inactive', 'suspended')
);

create policy admin_users_owner_update
on public.admin_users
for update
to authenticated
using (public.is_admin_owner())
with check (
  public.is_admin_owner()
  and role in ('admin', 'dispatcher', 'super_admin')
  and status in ('active', 'inactive', 'suspended')
);

update public.admin_users
set full_name = 'James Kamara',
    role = 'super_admin',
    status = 'active'
where lower(email) = 'james@caqualitysolutions.com';

update public.admin_users
set full_name = 'Alexis Bright',
    role = 'super_admin',
    status = 'active'
where lower(email) = 'alexisbright@caqualitysolutions.com';

insert into public.admin_users (id, full_name, email, role, status)
select u.id, 'James Kamara', 'james@caqualitysolutions.com', 'super_admin', 'active'
from auth.users u
where lower(u.email) = 'james@caqualitysolutions.com'
  and not exists (
    select 1
    from public.admin_users a
    where lower(a.email) = 'james@caqualitysolutions.com'
  )
on conflict (id)
do update set
  full_name = excluded.full_name,
  email = excluded.email,
  role = 'super_admin',
  status = 'active';

insert into public.admin_users (id, full_name, email, role, status)
select u.id, 'Alexis Bright', 'alexisbright@caqualitysolutions.com', 'super_admin', 'active'
from auth.users u
where lower(u.email) = 'alexisbright@caqualitysolutions.com'
  and not exists (
    select 1
    from public.admin_users a
    where lower(a.email) = 'alexisbright@caqualitysolutions.com'
  )
on conflict (id)
do update set
  full_name = excluded.full_name,
  email = excluded.email,
  role = 'super_admin',
  status = 'active';

-- Forgot password support does not require schema changes in Supabase Auth.
-- It is handled by Supabase Auth email recovery flow and the frontend reset page.

commit;
