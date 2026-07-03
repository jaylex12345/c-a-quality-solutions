-- v54 production verification checks
-- Run after migrations to prove required schema/policies exist.

-- 1) table existence
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('deliveries','bookings','customers','drivers','timesheets')
order by table_name;

-- 2) required columns by table
with required(table_name, column_name) as (
  values
    ('deliveries','status'),
    ('deliveries','assignment_status'),
    ('deliveries','booking_status'),
    ('deliveries','payment_status'),
    ('deliveries','stripe_session_id'),
    ('deliveries','checkout_session_id'),
    ('deliveries','proof_of_delivery'),
    ('deliveries','proof_photo_url'),
    ('deliveries','delivery_time'),
    ('deliveries','updated_at'),
    ('bookings','booking_status'),
    ('bookings','payment_status'),
    ('bookings','stripe_session_id'),
    ('bookings','checkout_session_id'),
    ('bookings','dropoff_address'),
    ('bookings','estimated_miles'),
    ('bookings','pickup_date'),
    ('bookings','instructions'),
    ('customers','password'),
    ('customers','address'),
    ('drivers','is_active'),
    ('drivers','status'),
    ('drivers','latitude'),
    ('drivers','longitude'),
    ('drivers','last_seen'),
    ('timesheets','driver_id'),
    ('timesheets','clock_in_at'),
    ('timesheets','clock_out_at'),
    ('timesheets','status')
)
select r.table_name, r.column_name,
       case when c.column_name is not null then 'OK' else 'MISSING' end as exists_flag
from required r
left join information_schema.columns c
  on c.table_schema = 'public'
 and c.table_name = r.table_name
 and c.column_name = r.column_name
order by r.table_name, r.column_name;

-- 3) key indexes
select schemaname, tablename, indexname
from pg_indexes
where schemaname = 'public'
  and indexname in (
    'idx_deliveries_tracking_number',
    'idx_deliveries_payment_status',
    'idx_deliveries_booking_status',
    'idx_deliveries_stripe_session_id',
    'idx_bookings_tracking_number',
    'idx_bookings_payment_status',
    'idx_bookings_booking_status',
    'idx_drivers_active_status',
    'idx_timesheets_driver_created'
  )
order by indexname;

-- 4) rls enabled state
select c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('deliveries','bookings','customers','drivers','timesheets')
order by c.relname;

-- 5) policies for timesheets + storage proofs
select schemaname, tablename, policyname, cmd, roles
from pg_policies
where (schemaname = 'public' and tablename = 'timesheets')
   or (schemaname = 'storage' and tablename = 'objects' and policyname like 'proofs_bucket_%')
order by schemaname, tablename, policyname;

-- 6) storage proofs bucket
select id, name, public
from storage.buckets
where id = 'proofs';

-- 7) alignment views
select table_schema, table_name
from information_schema.views
where table_schema = 'public'
  and table_name in ('v_dispatcher_deliveries','v_customer_tracking_latest','v_admin_kpi')
order by table_name;

-- 8) sample KPI row
select * from public.v_admin_kpi;
