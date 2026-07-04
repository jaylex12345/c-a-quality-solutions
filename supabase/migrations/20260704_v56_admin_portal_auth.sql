-- Version 5.6 secure admin portal auth
-- Adds admin_users table and RLS policies for authenticated admin-only access.

begin;

create table if not exists public.admin_users (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null unique,
  role text not null default 'admin',
  created_at timestamptz not null default now()
);

create index if not exists idx_admin_users_email on public.admin_users(email);
create index if not exists idx_admin_users_role on public.admin_users(role);

alter table public.admin_users enable row level security;

grant select, insert, update on public.admin_users to authenticated;

drop policy if exists admin_users_self_select on public.admin_users;
create policy admin_users_self_select
on public.admin_users
for select
to authenticated
using (id = auth.uid() and role = 'admin');

drop policy if exists admin_users_self_insert on public.admin_users;
create policy admin_users_self_insert
on public.admin_users
for insert
to authenticated
with check (id = auth.uid() and role = 'admin');

drop policy if exists admin_users_self_update on public.admin_users;
create policy admin_users_self_update
on public.admin_users
for update
to authenticated
using (id = auth.uid() and role = 'admin')
with check (id = auth.uid() and role = 'admin');

commit;
