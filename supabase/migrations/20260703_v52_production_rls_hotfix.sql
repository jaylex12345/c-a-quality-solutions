-- Version 5.2 production backend RLS + grants hotfix
-- Purpose:
-- 1) allow public/anon driver workflows on timesheets and deliveries
-- 2) allow proof uploads to storage bucket 'proofs'
-- 3) ensure customers table has booking compatibility columns

begin;

-- ----------
-- Schema grants
-- ----------
grant usage on schema public to anon, authenticated;
grant usage on schema storage to anon, authenticated;

-- ----------
-- Customers compatibility for booking flow
-- ----------
alter table if exists public.customers
  add column if not exists password text,
  add column if not exists address text;

grant select, insert, update on public.customers to anon, authenticated;

drop policy if exists customers_anon_select on public.customers;
drop policy if exists customers_anon_insert on public.customers;
drop policy if exists customers_anon_update on public.customers;

create policy customers_anon_select
on public.customers
for select
to anon, authenticated
using (true);

create policy customers_anon_insert
on public.customers
for insert
to anon, authenticated
with check (true);

create policy customers_anon_update
on public.customers
for update
to anon, authenticated
using (true)
with check (true);

-- ----------
-- Bookings write path
-- ----------
grant select, insert, update on public.bookings to anon, authenticated;

drop policy if exists bookings_anon_select on public.bookings;
drop policy if exists bookings_anon_insert on public.bookings;
drop policy if exists bookings_anon_update on public.bookings;

create policy bookings_anon_select
on public.bookings
for select
to anon, authenticated
using (true);

create policy bookings_anon_insert
on public.bookings
for insert
to anon, authenticated
with check (true);

create policy bookings_anon_update
on public.bookings
for update
to anon, authenticated
using (true)
with check (true);

-- ----------
-- Timesheets (Clock In / Out / Break Start / End)
-- ----------
alter table if exists public.timesheets enable row level security;

grant select, insert, update on public.timesheets to anon, authenticated;

drop policy if exists timesheets_anon_select on public.timesheets;
drop policy if exists timesheets_anon_insert on public.timesheets;
drop policy if exists timesheets_anon_update on public.timesheets;

create policy timesheets_anon_select
on public.timesheets
for select
to anon, authenticated
using (true);

create policy timesheets_anon_insert
on public.timesheets
for insert
to anon, authenticated
with check (true);

create policy timesheets_anon_update
on public.timesheets
for update
to anon, authenticated
using (true)
with check (true);

-- ----------
-- Deliveries (Accept / Reject / Update / Complete + Dispatcher assign/unassign)
-- ----------
alter table if exists public.deliveries enable row level security;

grant select, update on public.deliveries to anon, authenticated;

drop policy if exists deliveries_anon_select on public.deliveries;
drop policy if exists deliveries_anon_update on public.deliveries;

create policy deliveries_anon_select
on public.deliveries
for select
to anon, authenticated
using (true);

create policy deliveries_anon_update
on public.deliveries
for update
to anon, authenticated
using (true)
with check (true);

-- ----------
-- Storage objects for proofs bucket (Upload Proof)
-- ----------
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

commit;
