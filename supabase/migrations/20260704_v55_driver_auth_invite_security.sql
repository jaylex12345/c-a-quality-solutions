-- Version 5.5 driver auth invitation hardening
-- Adds secure account lifecycle columns for invited driver onboarding.

begin;

alter table if exists public.drivers
  add column if not exists auth_user_id uuid,
  add column if not exists role text default 'Driver',
  add column if not exists account_status text default 'Pending Activation',
  add column if not exists invited_at timestamptz,
  add column if not exists activated_at timestamptz,
  add column if not exists suspended_at timestamptz,
  add column if not exists force_password_reset boolean default false,
  add column if not exists last_login_at timestamptz,
  add column if not exists emergency_contact text,
  add column if not exists profile_photo_url text;

create index if not exists idx_drivers_auth_user_id on public.drivers(auth_user_id);
create index if not exists idx_drivers_account_status on public.drivers(account_status);
create index if not exists idx_drivers_last_login_at on public.drivers(last_login_at desc);

update public.drivers
set role = coalesce(nullif(role, ''), 'Driver'),
    account_status = case
      when coalesce(is_active, true) = false then 'Suspended'
      else coalesce(nullif(account_status, ''), 'Active')
    end,
    force_password_reset = coalesce(force_password_reset, false),
    status = case
      when coalesce(is_active, true) = false then 'Inactive'
      when status is null or status = '' or lower(status) = 'offline' then 'Active'
      else status
    end;

commit;
