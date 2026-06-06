-- Manager can access "Отель" section (building/room/service management UI).
insert into permissions(code)
values ('hotel:manage')
on conflict (code) do nothing;

insert into position_permissions(position_id, permission_id)
select pos.position_id, perm.permission_id
from positions pos
join permissions perm on perm.code = 'hotel:manage'
where pos.name = 'Менеджер'
on conflict (position_id, permission_id) do nothing;
