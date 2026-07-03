-- Version 5.0 full rebuild migration
-- Safe RLS setup for business platform tables

begin;

-- Ensure RLS is enabled
alter table if exists public.drivers enable row level security;
alter table if exists public.deliveries enable row level security;
alter table if exists public.customers enable row level security;
alter table if exists public.bookings enable row level security;
alter table if exists public.invoices enable row level security;
alter table if exists public.employees enable row level security;
alter table if exists public.payroll enable row level security;
alter table if exists public.timesheets enable row level security;
alter table if exists public.proofs enable row level security;

-- Drop existing overlapping policies (safe if already present)
drop policy if exists drivers_select on public.drivers;
drop policy if exists drivers_insert on public.drivers;
drop policy if exists drivers_update on public.drivers;
drop policy if exists drivers_delete on public.drivers;

drop policy if exists deliveries_select on public.deliveries;
drop policy if exists deliveries_insert on public.deliveries;
drop policy if exists deliveries_update on public.deliveries;
drop policy if exists deliveries_delete on public.deliveries;

drop policy if exists customers_select on public.customers;
drop policy if exists customers_insert on public.customers;
drop policy if exists customers_update on public.customers;
drop policy if exists customers_delete on public.customers;

drop policy if exists bookings_select on public.bookings;
drop policy if exists bookings_insert on public.bookings;
drop policy if exists bookings_update on public.bookings;
drop policy if exists bookings_delete on public.bookings;

drop policy if exists invoices_select on public.invoices;
drop policy if exists invoices_insert on public.invoices;
drop policy if exists invoices_update on public.invoices;
drop policy if exists invoices_delete on public.invoices;

drop policy if exists employees_select on public.employees;
drop policy if exists employees_insert on public.employees;
drop policy if exists employees_update on public.employees;
drop policy if exists employees_delete on public.employees;

drop policy if exists payroll_select on public.payroll;
drop policy if exists payroll_insert on public.payroll;
drop policy if exists payroll_update on public.payroll;
drop policy if exists payroll_delete on public.payroll;

drop policy if exists timesheets_select on public.timesheets;
drop policy if exists timesheets_insert on public.timesheets;
drop policy if exists timesheets_update on public.timesheets;
drop policy if exists timesheets_delete on public.timesheets;

drop policy if exists proofs_select on public.proofs;
drop policy if exists proofs_insert on public.proofs;
drop policy if exists proofs_update on public.proofs;
drop policy if exists proofs_delete on public.proofs;

-- Drivers
create policy drivers_select on public.drivers
for select
using (auth.role() = 'authenticated');

create policy drivers_insert on public.drivers
for insert
with check (auth.role() = 'authenticated');

create policy drivers_update on public.drivers
for update
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

create policy drivers_delete on public.drivers
for delete
using (auth.role() = 'authenticated');

-- Deliveries
create policy deliveries_select on public.deliveries
for select
using (auth.role() = 'authenticated');

create policy deliveries_insert on public.deliveries
for insert
with check (auth.role() = 'authenticated');

create policy deliveries_update on public.deliveries
for update
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

create policy deliveries_delete on public.deliveries
for delete
using (auth.role() = 'authenticated');

-- Customers
create policy customers_select on public.customers
for select
using (auth.role() = 'authenticated');

create policy customers_insert on public.customers
for insert
with check (true);

create policy customers_update on public.customers
for update
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

create policy customers_delete on public.customers
for delete
using (auth.role() = 'authenticated');

-- Bookings (public create allowed)
create policy bookings_select on public.bookings
for select
using (auth.role() = 'authenticated');

create policy bookings_insert on public.bookings
for insert
with check (true);

create policy bookings_update on public.bookings
for update
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

create policy bookings_delete on public.bookings
for delete
using (auth.role() = 'authenticated');

-- Invoices
create policy invoices_select on public.invoices
for select
using (auth.role() = 'authenticated');

create policy invoices_insert on public.invoices
for insert
with check (auth.role() = 'authenticated');

create policy invoices_update on public.invoices
for update
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

create policy invoices_delete on public.invoices
for delete
using (auth.role() = 'authenticated');

-- Employees
create policy employees_select on public.employees
for select
using (auth.role() = 'authenticated');

create policy employees_insert on public.employees
for insert
with check (auth.role() = 'authenticated');

create policy employees_update on public.employees
for update
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

create policy employees_delete on public.employees
for delete
using (auth.role() = 'authenticated');

-- Payroll
create policy payroll_select on public.payroll
for select
using (auth.role() = 'authenticated');

create policy payroll_insert on public.payroll
for insert
with check (auth.role() = 'authenticated');

create policy payroll_update on public.payroll
for update
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

create policy payroll_delete on public.payroll
for delete
using (auth.role() = 'authenticated');

-- Timesheets
create policy timesheets_select on public.timesheets
for select
using (auth.role() = 'authenticated');

create policy timesheets_insert on public.timesheets
for insert
with check (auth.role() = 'authenticated');

create policy timesheets_update on public.timesheets
for update
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

create policy timesheets_delete on public.timesheets
for delete
using (auth.role() = 'authenticated');

-- Proofs
create policy proofs_select on public.proofs
for select
using (auth.role() = 'authenticated');

create policy proofs_insert on public.proofs
for insert
with check (auth.role() = 'authenticated');

create policy proofs_update on public.proofs
for update
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

create policy proofs_delete on public.proofs
for delete
using (auth.role() = 'authenticated');

commit;
