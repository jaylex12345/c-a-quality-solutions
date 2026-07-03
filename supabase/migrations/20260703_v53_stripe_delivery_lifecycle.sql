begin;

alter table if exists public.deliveries
  add column if not exists customer_id uuid references public.customers(id) on delete set null,
  add column if not exists destination_address text,
  add column if not exists estimated_distance_miles numeric(10,2),
  add column if not exists estimated_price numeric(12,2),
  add column if not exists notes text,
  add column if not exists payment_status text default 'Pending',
  add column if not exists booking_status text default 'Pending Dispatch',
  add column if not exists stripe_session_id text,
  add column if not exists checkout_session_id text,
  add column if not exists source text default 'website';

create index if not exists idx_deliveries_stripe_session_id on public.deliveries(stripe_session_id);
create index if not exists idx_deliveries_payment_status on public.deliveries(payment_status);
create index if not exists idx_deliveries_booking_status on public.deliveries(booking_status);
create index if not exists idx_deliveries_tracking_number on public.deliveries(tracking_number);

update public.deliveries
set payment_status = coalesce(payment_status, 'Pending')
where payment_status is null;

update public.deliveries
set booking_status = coalesce(booking_status, 'Pending Dispatch')
where booking_status is null;

commit;
