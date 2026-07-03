-- Version 5.4 production schema alignment
-- Covers deliveries/bookings/customers/drivers schema parity,
-- timesheets + storage policies, status/payment fields, and query-alignment views.

begin;

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Deliveries
alter table if exists public.deliveries
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now(),
  add column if not exists customer_id uuid references public.customers(id) on delete set null,
  add column if not exists customer_email text,
  add column if not exists customer_phone text,
  add column if not exists destination_address text,
  add column if not exists estimated_distance_miles numeric(10,2),
  add column if not exists estimated_price numeric(12,2),
  add column if not exists notes text,
  add column if not exists status text default 'Pending',
  add column if not exists assignment_status text default 'Unassigned',
  add column if not exists booking_status text default 'Pending Dispatch',
  add column if not exists payment_status text default 'Pending',
  add column if not exists stripe_session_id text,
  add column if not exists checkout_session_id text,
  add column if not exists source text default 'website',
  add column if not exists proof_of_delivery text,
  add column if not exists proof_photo_url text,
  add column if not exists delivery_time timestamptz,
  add column if not exists total_amount numeric(12,2),
  add column if not exists amount numeric(12,2),
  add column if not exists delivery_fee numeric(12,2);

-- Bookings
alter table if exists public.bookings
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now(),
  add column if not exists customer_id uuid references public.customers(id) on delete set null,
  add column if not exists email text,
  add column if not exists service_type text,
  add column if not exists dropoff_address text,
  add column if not exists estimated_miles numeric(10,2),
  add column if not exists pickup_date date,
  add column if not exists instructions text,
  add column if not exists booking_status text default 'Pending Dispatch',
  add column if not exists payment_status text default 'Pending',
  add column if not exists stripe_session_id text,
  add column if not exists checkout_session_id text,
  add column if not exists source text default 'website';

-- Customers
alter table if exists public.customers
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now(),
  add column if not exists password text,
  add column if not exists address text;

-- Drivers
alter table if exists public.drivers
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now(),
  add column if not exists email text,
  add column if not exists phone text,
  add column if not exists status text default 'Offline',
  add column if not exists is_active boolean default true,
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  add column if not exists last_seen timestamptz,
  add column if not exists vehicle text,
  add column if not exists vehicle_type text,
  add column if not exists license_plate text,
  add column if not exists completed_today integer default 0,
  add column if not exists completed_total integer default 0,
  add column if not exists rating numeric(3,2) default 5.00;

-- Timesheets
alter table if exists public.timesheets
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now(),
  add column if not exists status text default 'Open';

-- Updated-at triggers
DO $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'set_updated_at_deliveries') then
    create trigger set_updated_at_deliveries
      before update on public.deliveries
      for each row execute function public.set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'set_updated_at_bookings') then
    create trigger set_updated_at_bookings
      before update on public.bookings
      for each row execute function public.set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'set_updated_at_customers') then
    create trigger set_updated_at_customers
      before update on public.customers
      for each row execute function public.set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'set_updated_at_drivers') then
    create trigger set_updated_at_drivers
      before update on public.drivers
      for each row execute function public.set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'set_updated_at_timesheets') then
    create trigger set_updated_at_timesheets
      before update on public.timesheets
      for each row execute function public.set_updated_at();
  end if;
end
$$;

-- Status normalization
update public.deliveries
set status = case lower(coalesce(status, 'pending'))
  when 'pending' then 'Pending'
  when 'assigned' then 'Assigned'
  when 'pending acceptance' then 'Assigned'
  when 'accepted' then 'Accepted'
  when 'picked up' then 'Picked Up'
  when 'in transit' then 'Driver En Route'
  when 'driver en route' then 'Driver En Route'
  when 'out for delivery' then 'Out for Delivery'
  when 'completed' then 'Delivered'
  when 'delivered' then 'Delivered'
  when 'cancelled' then 'Cancelled'
  else status
end;

update public.deliveries
set assignment_status = case
  when status = 'Delivered' then 'Completed'
  when driver_id is null and coalesce(assignment_status, '') = '' then 'Unassigned'
  else coalesce(assignment_status, case when driver_id is null then 'Unassigned' else 'Assigned' end)
end;

update public.deliveries
set payment_status = coalesce(nullif(payment_status, ''), 'Pending'),
    booking_status = coalesce(nullif(booking_status, ''),
      case
        when status = 'Delivered' then 'Delivered'
        when status = 'Cancelled' then 'Cancelled'
        when driver_id is null then 'Pending Dispatch'
        when coalesce(assignment_status, '') in ('Pending Acceptance', 'Assigned', 'Accepted') then 'Dispatched'
        else 'Pending Dispatch'
      end
    ),
    source = coalesce(nullif(source, ''), 'website');

update public.bookings
set payment_status = coalesce(nullif(payment_status, ''), 'Pending'),
    booking_status = coalesce(nullif(booking_status, ''), 'Pending Dispatch'),
    source = coalesce(nullif(source, ''), 'website'),
    dropoff_address = coalesce(dropoff_address, destination_address),
    estimated_miles = coalesce(estimated_miles, estimated_distance_miles),
    pickup_date = coalesce(pickup_date, delivery_date),
    instructions = coalesce(instructions, notes),
    email = coalesce(email, customer_email);

-- Indexes
create index if not exists idx_deliveries_tracking_number on public.deliveries(tracking_number);
create index if not exists idx_deliveries_status on public.deliveries(status);
create index if not exists idx_deliveries_assignment_status on public.deliveries(assignment_status);
create index if not exists idx_deliveries_booking_status on public.deliveries(booking_status);
create index if not exists idx_deliveries_payment_status on public.deliveries(payment_status);
create index if not exists idx_deliveries_created_at on public.deliveries(created_at desc);
create index if not exists idx_deliveries_delivery_time on public.deliveries(delivery_time desc);
create index if not exists idx_deliveries_stripe_session_id on public.deliveries(stripe_session_id);

create index if not exists idx_bookings_tracking_number on public.bookings(tracking_number);
create index if not exists idx_bookings_booking_status on public.bookings(booking_status);
create index if not exists idx_bookings_payment_status on public.bookings(payment_status);
create index if not exists idx_bookings_checkout_session_id on public.bookings(checkout_session_id);
create index if not exists idx_bookings_stripe_session_id on public.bookings(stripe_session_id);

create index if not exists idx_drivers_active_status on public.drivers(is_active, status);
create index if not exists idx_drivers_last_seen on public.drivers(last_seen desc);
create index if not exists idx_timesheets_driver_created on public.timesheets(driver_id, created_at desc);

-- RLS + policies
alter table if exists public.deliveries enable row level security;
alter table if exists public.bookings enable row level security;
alter table if exists public.customers enable row level security;
alter table if exists public.drivers enable row level security;
alter table if exists public.timesheets enable row level security;

grant usage on schema public to anon, authenticated;
grant select, insert, update on public.deliveries to anon, authenticated;
grant select, insert, update on public.bookings to anon, authenticated;
grant select, insert, update on public.customers to anon, authenticated;
grant select, insert, update on public.drivers to anon, authenticated;
grant select, insert, update on public.timesheets to anon, authenticated;

drop policy if exists deliveries_anon_select on public.deliveries;
drop policy if exists deliveries_anon_insert on public.deliveries;
drop policy if exists deliveries_anon_update on public.deliveries;
create policy deliveries_anon_select on public.deliveries for select to anon, authenticated using (true);
create policy deliveries_anon_insert on public.deliveries for insert to anon, authenticated with check (true);
create policy deliveries_anon_update on public.deliveries for update to anon, authenticated using (true) with check (true);

drop policy if exists bookings_anon_select on public.bookings;
drop policy if exists bookings_anon_insert on public.bookings;
drop policy if exists bookings_anon_update on public.bookings;
create policy bookings_anon_select on public.bookings for select to anon, authenticated using (true);
create policy bookings_anon_insert on public.bookings for insert to anon, authenticated with check (true);
create policy bookings_anon_update on public.bookings for update to anon, authenticated using (true) with check (true);

drop policy if exists customers_anon_select on public.customers;
drop policy if exists customers_anon_insert on public.customers;
drop policy if exists customers_anon_update on public.customers;
create policy customers_anon_select on public.customers for select to anon, authenticated using (true);
create policy customers_anon_insert on public.customers for insert to anon, authenticated with check (true);
create policy customers_anon_update on public.customers for update to anon, authenticated using (true) with check (true);

drop policy if exists drivers_anon_select on public.drivers;
drop policy if exists drivers_anon_insert on public.drivers;
drop policy if exists drivers_anon_update on public.drivers;
create policy drivers_anon_select on public.drivers for select to anon, authenticated using (true);
create policy drivers_anon_insert on public.drivers for insert to anon, authenticated with check (true);
create policy drivers_anon_update on public.drivers for update to anon, authenticated using (true) with check (true);

drop policy if exists timesheets_anon_select on public.timesheets;
drop policy if exists timesheets_anon_insert on public.timesheets;
drop policy if exists timesheets_anon_update on public.timesheets;
create policy timesheets_anon_select on public.timesheets for select to anon, authenticated using (true);
create policy timesheets_anon_insert on public.timesheets for insert to anon, authenticated with check (true);
create policy timesheets_anon_update on public.timesheets for update to anon, authenticated using (true) with check (true);

-- Storage / proof policies
insert into storage.buckets (id, name, public)
select 'proofs', 'proofs', true
where not exists (select 1 from storage.buckets where id = 'proofs');

grant usage on schema storage to anon, authenticated;
grant select, insert, update on storage.objects to anon, authenticated;

drop policy if exists proofs_bucket_select_anon on storage.objects;
drop policy if exists proofs_bucket_insert_anon on storage.objects;
drop policy if exists proofs_bucket_update_anon on storage.objects;

create policy proofs_bucket_select_anon
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'proofs');

create policy proofs_bucket_insert_anon
on storage.objects
for insert
to anon, authenticated
with check (bucket_id = 'proofs');

create policy proofs_bucket_update_anon
on storage.objects
for update
to anon, authenticated
using (bucket_id = 'proofs')
with check (bucket_id = 'proofs');

-- Query alignment views
create or replace view public.v_dispatcher_deliveries as
select *
from public.deliveries;

create or replace view public.v_customer_tracking_latest as
select distinct on (tracking_number)
  id,
  tracking_number,
  customer_name,
  driver_id,
  driver_name,
  status,
  assignment_status,
  booking_status,
  payment_status,
  pickup_location,
  delivery_location,
  proof_of_delivery,
  proof_photo_url,
  delivery_time,
  driver_notes,
  received_by,
  relationship,
  completed_by,
  created_at,
  updated_at
from public.deliveries
where tracking_number is not null and tracking_number <> ''
order by tracking_number, coalesce(delivery_time, updated_at, created_at) desc;

create or replace view public.v_admin_kpi as
select
  count(*) filter (where status in ('Pending','Assigned','Accepted','Driver En Route','Picked Up','Out for Delivery')) as pending_jobs,
  count(*) filter (where status = 'Delivered') as completed_jobs,
  count(*) as total_deliveries,
  coalesce(sum(case when lower(coalesce(payment_status, '')) = 'paid' then coalesce(total_amount, amount, delivery_fee, cod_amount, 0) else 0 end), 0)::numeric(12,2) as stripe_paid_revenue
from public.deliveries;

grant select on public.v_dispatcher_deliveries to anon, authenticated;
grant select on public.v_customer_tracking_latest to anon, authenticated;
grant select on public.v_admin_kpi to anon, authenticated;

commit;
