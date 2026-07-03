-- Version 5.0 permissions hotfix for timesheets/payroll
-- Fixes 403 permission denied on driver time clock and payroll operations.

alter table public.timesheets enable row level security;

drop policy if exists "Allow public read timesheets" on public.timesheets;
drop policy if exists "Allow public insert timesheets" on public.timesheets;
drop policy if exists "Allow public update timesheets" on public.timesheets;

create policy "Allow public read timesheets"
on public.timesheets
for select
using (true);

create policy "Allow public insert timesheets"
on public.timesheets
for insert
with check (true);

create policy "Allow public update timesheets"
on public.timesheets
for update
using (true)
with check (true);

alter table public.payroll enable row level security;

drop policy if exists "Allow public read payroll" on public.payroll;
drop policy if exists "Allow public insert payroll" on public.payroll;
drop policy if exists "Allow public update payroll" on public.payroll;

create policy "Allow public read payroll"
on public.payroll
for select
using (true);

create policy "Allow public insert payroll"
on public.payroll
for insert
with check (true);

create policy "Allow public update payroll"
on public.payroll
for update
using (true)
with check (true);
