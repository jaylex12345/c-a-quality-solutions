-- Version 5.7 super admin bootstrap and policy expansion
-- Adds super_admin role support and promotes production super admin emails.

begin;

-- Ensure role consistency for admin_users.
alter table if exists public.admin_users
  alter column role set default 'admin';

-- Recreate policies so both admin and super_admin can access portal resources.
drop policy if exists admin_users_self_select on public.admin_users;
create policy admin_users_self_select
on public.admin_users
for select
to authenticated
using (id = auth.uid() and role in ('admin', 'super_admin'));

drop policy if exists admin_users_self_insert on public.admin_users;
create policy admin_users_self_insert
on public.admin_users
for insert
to authenticated
with check (id = auth.uid() and role in ('admin', 'super_admin'));

drop policy if exists admin_users_self_update on public.admin_users;
create policy admin_users_self_update
on public.admin_users
for update
to authenticated
using (id = auth.uid() and role in ('admin', 'super_admin'))
with check (id = auth.uid() and role in ('admin', 'super_admin'));

-- Promote permanent super admins when their auth identities exist.
update public.admin_users
set full_name = 'James Kamara',
    role = 'super_admin'
where lower(email) = 'james@caqualitysolutions.com';

update public.admin_users
set full_name = 'Alexis Bright',
    role = 'super_admin'
where lower(email) = 'alexisbright@caqualitysolutions.com';

insert into public.admin_users (id, full_name, email, role)
select u.id, 'James Kamara', 'james@caqualitysolutions.com', 'super_admin'
from auth.users u
where lower(u.email) = 'james@caqualitysolutions.com'
  and not exists (
    select 1
    from public.admin_users a
    where lower(a.email) = 'james@caqualitysolutions.com'
  );

insert into public.admin_users (id, full_name, email, role)
select u.id, 'Alexis Bright', 'alexisbright@caqualitysolutions.com', 'super_admin'
from auth.users u
where lower(u.email) = 'alexisbright@caqualitysolutions.com'
  and not exists (
    select 1
    from public.admin_users a
    where lower(a.email) = 'alexisbright@caqualitysolutions.com'
  );

commit;
