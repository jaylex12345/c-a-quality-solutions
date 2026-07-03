-- Version 5.1 frontend schema sync
-- Adds compatibility columns referenced by legacy and current frontend pages.

begin;

alter table if exists public.bookings
  add column if not exists service_type text,
  add column if not exists dropoff_address text,
  add column if not exists estimated_miles numeric(10,2),
  add column if not exists pickup_date date,
  add column if not exists instructions text,
  add column if not exists email text;

alter table if exists public.deliveries
  add column if not exists driver_name text,
  add column if not exists assignment_status text,
  add column if not exists proof_of_delivery text,
  add column if not exists delivery_time timestamptz,
  add column if not exists driver_notes text,
  add column if not exists received_by text,
  add column if not exists relationship text,
  add column if not exists completed_by text,
  add column if not exists recipient_email text,
  add column if not exists delivery_fee numeric(12,2),
  add column if not exists total_amount numeric(12,2),
  add column if not exists amount numeric(12,2);

alter table if exists public.drivers
  add column if not exists last_seen timestamptz;

update public.bookings
set
  dropoff_address = coalesce(dropoff_address, destination_address),
  estimated_miles = coalesce(estimated_miles, estimated_distance_miles),
  pickup_date = coalesce(pickup_date, delivery_date),
  instructions = coalesce(instructions, notes),
  service_type = coalesce(service_type, package_type),
  email = coalesce(email, customer_email)
where true;

update public.deliveries
set
  assignment_status = coalesce(assignment_status, case when driver_id is null then 'Unassigned' else 'Assigned' end),
  proof_of_delivery = coalesce(proof_of_delivery, proof_photo_url)
where true;

commit;
