alter table public.drivers
  add column if not exists photo_url text,
  add column if not exists vehicle text,
  add column if not exists vehicle_type text,
  add column if not exists license_plate text,
  add column if not exists license_number text,
  add column if not exists insurance_expiration date,
  add column if not exists license_expiration date,
  add column if not exists availability text,
  add column if not exists current_job text,
  add column if not exists completed_today integer default 0,
  add column if not exists rating numeric(3,2) default 5.00,
  add column if not exists battery_level text,
  add column if not exists email text,
  add column if not exists completed_total integer default 0;

alter table public.deliveries
  add column if not exists company_name text,
  add column if not exists pickup_address text,
  add column if not exists delivery_address text,
  add column if not exists pickup_location text,
  add column if not exists delivery_location text,
  add column if not exists pickup_contact text,
  add column if not exists delivery_contact text,
  add column if not exists recipient_phone text,
  add column if not exists customer_phone text,
  add column if not exists customer_email text,
  add column if not exists package_type text,
  add column if not exists package_weight numeric(8,2),
  add column if not exists priority text default 'Standard',
  add column if not exists special_instructions text,
  add column if not exists signature_required boolean default false,
  add column if not exists photo_required boolean default false,
  add column if not exists cod_amount numeric(12,2) default 0,
  add column if not exists estimated_delivery_time timestamptz,
  add column if not exists proof_photo_url text,
  add column if not exists pickup_time timestamptz,
  add column if not exists driver_email text,
  add column if not exists driver_vehicle text;

update public.deliveries
set assignment_status = coalesce(assignment_status, case when driver_id is null then 'Unassigned' else 'Assigned' end)
where assignment_status is null;