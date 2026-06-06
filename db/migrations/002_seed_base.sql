-- Minimal base seed: классы отелей, демо-адрес, один корпус, типы номеров, права и две должности с маппингом.
-- Большие демо-данные см. migration 004 (однократно применится при следующем запуске API).

do $$
declare
  v_city_id int;
  v_street_id int;
  v_house_id int;
  v_building_id int;
  v_pos_manager int;
  v_pos_reception int;
begin
  insert into hotel_classes(stars, name)
  values (3, '3 звезды'), (4, '4 звезды'), (5, '5 звёзд')
  on conflict (stars) do nothing;

  insert into cities(name) values ('Москва') on conflict (name) do nothing returning city_id into v_city_id;
  if v_city_id is null then select city_id into v_city_id from cities where name = 'Москва' limit 1; end if;

  insert into streets(name) values ('Тверская') on conflict (name) do nothing returning street_id into v_street_id;
  if v_street_id is null then select street_id into v_street_id from streets where name = 'Тверская' limit 1; end if;

  insert into houses(name) values ('1') on conflict (name) do nothing returning house_id into v_house_id;
  if v_house_id is null then select house_id into v_house_id from houses where name = '1' limit 1; end if;

  insert into city_streets(city_id, street_id)
  values (v_city_id, v_street_id)
  on conflict do nothing;

  insert into city_street_houses(city_id, street_id, house_id)
  values (v_city_id, v_street_id, v_house_id)
  on conflict do nothing;

  insert into buildings(hotel_class_stars, floors, city_id, street_id, house_id)
  values (4, 5, v_city_id, v_street_id, v_house_id)
  on conflict (hotel_class_stars, floors, city_id, street_id, house_id) do nothing
  returning building_id into v_building_id;

  if v_building_id is null then
    select building_id into v_building_id
    from buildings
    where hotel_class_stars = 4
      and floors = 5
      and city_id = v_city_id
      and street_id = v_street_id
      and house_id = v_house_id
    limit 1;
  end if;

  insert into room_types(name, capacity)
  values ('Стандарт', 2), ('Комфорт', 3)
  on conflict (name) do nothing;

  insert into room_number_registry(room_number)
  select x from unnest(array[101, 102, 201, 202]::int[]) as x
  on conflict do nothing;

  insert into rooms_in_building(building_id, room_number, room_type_id, cost, floor)
  select v_building_id, v.room_number, rt.room_type_id, v.cost, v.floor
  from (
    values
      (101, 5200.00::numeric, 1),
      (102, 5400.00::numeric, 1),
      (201, 7200.00::numeric, 2),
      (202, 7600.00::numeric, 2)
  ) as v(room_number, cost, floor)
  join room_types rt on rt.name = case when v.floor = 1 then 'Стандарт' else 'Комфорт' end
  on conflict (building_id, room_number) do nothing;

  insert into services(name)
  values ('Завтрак'), ('Трансфер'), ('Ужин')
  on conflict (name) do nothing;

  insert into offered_services(service_id, building_id, cost)
  select s.service_id, v_building_id,
         case s.name
           when 'Завтрак' then 1200.00
           when 'Ужин' then 2000.00
           when 'Трансфер' then 3500.00
           else 1000.00
         end::numeric(12, 2)
  from services s
  where s.name in ('Завтрак', 'Ужин', 'Трансфер')
  on conflict (service_id, building_id) do nothing;

  insert into permissions(code)
  values
    ('booking:view'),
    ('booking:create'),
    ('booking:cancel'),
    ('booking:service:add'),
    ('clients:create'),
    ('admin:register_staff')
  on conflict (code) do nothing;

  insert into positions(name)
  values ('Ресепшионист'), ('Менеджер')
  on conflict (name) do nothing;

  select position_id into v_pos_reception from positions where name = 'Ресепшионист' limit 1;
  select position_id into v_pos_manager from positions where name = 'Менеджер' limit 1;

  insert into position_permissions(position_id, permission_id)
  select v_pos_reception, p.permission_id
  from permissions p
  where p.code in ('booking:view', 'booking:create', 'booking:service:add', 'clients:create')
  on conflict (position_id, permission_id) do nothing;

  insert into position_permissions(position_id, permission_id)
  select v_pos_manager, p.permission_id
  from permissions p
  where p.code in ('booking:view', 'booking:create', 'booking:cancel', 'booking:service:add', 'clients:create')
  on conflict (position_id, permission_id) do nothing;

  -- Две демонстрационные записи кадров (без аккаунтов входа — их создаёт сетевой админ через UI).
  insert into employees(building_id, position_id, last_name, first_name, middle_name, passport, phone)
  select v_building_id, v_pos_reception, 'Иванов', 'Сергей', 'Петрович', '1000000001', '+79160000001'
  where not exists (select 1 from employees where passport = '1000000001');

  insert into employees(building_id, position_id, last_name, first_name, middle_name, passport, phone)
  select v_building_id, v_pos_manager, 'Петрова', 'Анна', 'Игоревна', '1000000002', '+79160000002'
  where not exists (select 1 from employees where passport = '1000000002');

  raise notice 'Base seed OK: demo building_id=%', v_building_id;
end $$;
