-- Additional functionality for "выселение" + more RBAC permissions.

create table if not exists booking_actual_checkouts (
  booking_id int primary key references bookings(booking_id) on delete cascade,
  checked_out_at date not null default current_date,
  checked_out_by_account_id int null references user_accounts(account_id) on delete set null
);

-- Extra permissions (used by UI pages).
insert into permissions(code)
values
  ('booking:upcoming'),
  ('booking:occupancy'),
  ('booking:checkout')
on conflict (code) do nothing;

-- Map permissions to positions.
-- Receptionist: view/create/cancel/services + new pages.
insert into position_permissions(position_id, permission_id)
select pos.position_id, perm.permission_id
from positions pos
join permissions perm on true
where pos.name = 'Ресепшионист'
  and perm.code in ('booking:upcoming','booking:occupancy','booking:checkout','booking:cancel','booking:view','booking:create','booking:service:add')
on conflict (position_id, permission_id) do nothing;

-- Manager: same set.
insert into position_permissions(position_id, permission_id)
select pos.position_id, perm.permission_id
from positions pos
join permissions perm on true
where pos.name = 'Менеджер'
  and perm.code in ('booking:upcoming','booking:occupancy','booking:checkout','booking:cancel','booking:view','booking:create','booking:service:add','clients:create')
on conflict (position_id, permission_id) do nothing;

