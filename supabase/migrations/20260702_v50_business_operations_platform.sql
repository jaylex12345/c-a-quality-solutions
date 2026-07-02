-- Version 5.0 Business Operations Platform
-- Adds business operations modules while keeping existing tables intact.

create extension if not exists pgcrypto;

create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  employee_id text unique,
  first_name text not null,
  last_name text not null,
  phone text,
  email text,
  address text,
  emergency_contact text,
  job_title text,
  hire_date date,
  hourly_rate numeric(10,2) default 0,
  employment_type text default 'Full-Time',
  driver_license text,
  license_expiration date,
  vehicle_assignment text,
  status text default 'Active',
  profile_photo text,
  payroll_bonus numeric(10,2) default 0,
  mileage_reimbursement numeric(10,2) default 0,
  deductions_placeholder numeric(10,2) default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.timesheets (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references public.employees(id) on delete set null,
  driver_id uuid references public.drivers(id) on delete set null,
  employee_name text,
  clock_in_at timestamptz,
  clock_out_at timestamptz,
  break_started_at timestamptz,
  break_ended_at timestamptz,
  break_minutes numeric(10,2) default 0,
  hours numeric(10,2) default 0,
  hours_today numeric(10,2) default 0,
  hours_week numeric(10,2) default 0,
  overtime_hours numeric(10,2) default 0,
  status text default 'Open',
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.payroll (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references public.employees(id) on delete set null,
  employee_name text,
  period_type text default 'weekly',
  period_start date,
  period_end date,
  hours numeric(10,2) default 0,
  overtime numeric(10,2) default 0,
  hourly_rate numeric(10,2) default 0,
  bonus numeric(10,2) default 0,
  mileage numeric(10,2) default 0,
  gross_pay numeric(12,2) default 0,
  deductions numeric(12,2) default 0,
  net_pay numeric(12,2) default 0,
  status text default 'Pending',
  paid_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  business_name text not null,
  contact_person text not null,
  phone text,
  email text,
  billing_address text,
  pickup_address text,
  delivery_address text,
  payment_terms text,
  account_status text default 'Active',
  notes text,
  outstanding_balance numeric(12,2) default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text unique,
  customer_id uuid references public.customers(id) on delete set null,
  customer_name text,
  customer_email text,
  delivery_ids text[],
  amount numeric(12,2) default 0,
  due_date date,
  status text default 'Pending',
  paid_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  tracking_number text,
  customer_name text,
  customer_email text,
  customer_phone text,
  pickup_address text,
  destination_address text,
  package_type text,
  package_weight_lbs numeric(10,2),
  delivery_date date,
  delivery_time text,
  estimated_distance_miles numeric(10,2),
  estimated_price numeric(12,2),
  payment_status text default 'Pending',
  checkout_session_id text,
  source text default 'website',
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_employees_status on public.employees(status);
create index if not exists idx_timesheets_employee_id on public.timesheets(employee_id);
create index if not exists idx_payroll_employee_id on public.payroll(employee_id);
create index if not exists idx_customers_business_name on public.customers(business_name);
create index if not exists idx_invoices_status on public.invoices(status);
create index if not exists idx_bookings_tracking_number on public.bookings(tracking_number);

alter table public.employees enable row level security;
alter table public.timesheets enable row level security;
alter table public.payroll enable row level security;
alter table public.customers enable row level security;
alter table public.invoices enable row level security;
alter table public.bookings enable row level security;

-- Browser client uses publishable key. These permissive policies match current project style.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='employees' and policyname='employees_public_all'
  ) then
    create policy employees_public_all on public.employees for all using (true) with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='timesheets' and policyname='timesheets_public_all'
  ) then
    create policy timesheets_public_all on public.timesheets for all using (true) with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='payroll' and policyname='payroll_public_all'
  ) then
    create policy payroll_public_all on public.payroll for all using (true) with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='customers' and policyname='customers_public_all'
  ) then
    create policy customers_public_all on public.customers for all using (true) with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='invoices' and policyname='invoices_public_all'
  ) then
    create policy invoices_public_all on public.invoices for all using (true) with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='bookings' and policyname='bookings_public_all'
  ) then
    create policy bookings_public_all on public.bookings for all using (true) with check (true);
  end if;
end
$$;
