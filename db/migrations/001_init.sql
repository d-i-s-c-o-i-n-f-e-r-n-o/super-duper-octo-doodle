-- Core schema for HotelWebApp
-- Designed to match API layer table/column names.

create table if not exists schema_migrations_dummy(id int);

-- Auth / RBAC
create table if not exists user_accounts (
  account_id serial primary key,
  email varchar(120) not null unique,
  password_hash text not null,
  account_type varchar(20) not null check (account_type in ('network_admin', 'hotel_staff')),
  staff_employee_id int null,
  staff_building_id int null,
  created_at timestamptz not null default now(),
  constraint user_accounts_type_staff_check
    check (
      (account_type = 'network_admin' and staff_employee_id is null and staff_building_id is null)
      or
      (account_type = 'hotel_staff' and staff_employee_id is not null and staff_building_id is not null)
    )
);

create table if not exists auth_login_attempts (
  email_hash text not null,
  ip_hash text not null,
  fail_count int not null default 0,
  locked_until timestamptz null,
  last_failed_at timestamptz null,
  primary key (email_hash, ip_hash)
);

create table if not exists permissions (
  permission_id serial primary key,
  code text not null unique
);

create table if not exists positions (
  position_id serial primary key,
  name text not null unique
);

create table if not exists position_permissions (
  position_id int not null references positions(position_id) on delete cascade,
  permission_id int not null references permissions(permission_id) on delete cascade,
  primary key (position_id, permission_id)
);

-- Address / Buildings
create table if not exists hotel_classes (
  stars int primary key,
  name text not null
);

create table if not exists cities (
  city_id serial primary key,
  name varchar(50) not null unique
);

create table if not exists streets (
  street_id serial primary key,
  name varchar(50) not null unique
);

create table if not exists houses (
  house_id serial primary key,
  name varchar(50) not null unique
);

create table if not exists city_streets (
  city_id int not null references cities(city_id) on delete restrict,
  street_id int not null references streets(street_id) on delete restrict,
  primary key (city_id, street_id)
);

create table if not exists city_street_houses (
  city_id int not null,
  street_id int not null,
  house_id int not null,
  primary key (city_id, street_id, house_id),
  foreign key (city_id, street_id) references city_streets(city_id, street_id) on delete restrict,
  foreign key (house_id) references houses(house_id) on delete restrict
);

create table if not exists buildings (
  building_id serial primary key,
  hotel_class_stars int not null references hotel_classes(stars) on delete restrict,
  floors int not null default 1,
  city_id int not null,
  street_id int not null,
  house_id int not null,
  foreign key (city_id, street_id, house_id) references city_street_houses(city_id, street_id, house_id) on delete restrict,
  unique (hotel_class_stars, floors, city_id, street_id, house_id)
);

-- Employees
create table if not exists employees (
  employee_id serial not null,
  building_id int not null references buildings(building_id) on delete restrict,
  position_id int not null references positions(position_id) on delete restrict,
  last_name varchar(30) not null,
  first_name varchar(30) not null,
  middle_name varchar(30) not null default '',
  passport varchar(10) not null unique,
  phone varchar(13) not null,
  primary key (employee_id, building_id)
);

do $$
begin
  -- Add FK after employees table exists (migration ordering).
  alter table user_accounts
    add constraint user_accounts_staff_fk
    foreign key (staff_employee_id, staff_building_id)
    references employees(employee_id, building_id)
    on delete set null;
exception
  when duplicate_object then null;
end $$;

-- Services
create table if not exists services (
  service_id serial primary key,
  name varchar(50) not null unique
);

create table if not exists offered_services (
  service_id int not null references services(service_id) on delete cascade,
  building_id int not null references buildings(building_id) on delete cascade,
  cost numeric(12,2) not null check (cost >= 0),
  primary key (service_id, building_id)
);

-- Rooms
create table if not exists room_types (
  room_type_id serial primary key,
  name varchar(100) not null unique,
  capacity int not null check (capacity > 0)
);

create table if not exists room_number_registry (
  room_number int primary key
);

create table if not exists rooms_in_building (
  building_id int not null references buildings(building_id) on delete restrict,
  room_number int not null references room_number_registry(room_number) on delete restrict,
  room_type_id int not null references room_types(room_type_id) on delete restrict,
  cost numeric(12,2) not null check (cost >= 0),
  floor int not null check (floor >= 0),
  primary key (building_id, room_number)
);

-- Clients
create table if not exists clients (
  client_id serial primary key,
  last_name varchar(30) not null,
  first_name varchar(30) not null,
  middle_name varchar(30) not null default '',
  passport varchar(10) not null unique,
  phone varchar(13) not null,
  email varchar(120) not null unique
);

-- Bookings / Cancellations / Booking services
create table if not exists bookings (
  booking_id serial primary key,
  client_id int not null references clients(client_id) on delete restrict,
  check_in date not null,
  check_out date not null,
  prepayment_deadline date not null,

  created_staff_employee_id int not null,
  created_staff_building_id int not null,

  booking_building_id int not null,
  room_number int not null,

  foreign key (created_staff_employee_id, created_staff_building_id)
    references employees(employee_id, building_id) on delete restrict,

  foreign key (booking_building_id, room_number)
    references rooms_in_building(building_id, room_number) on delete restrict,

  constraint bookings_dates_check check (check_out > check_in),
  constraint bookings_staff_same_building_check check (created_staff_building_id = booking_building_id)
);

create table if not exists booking_cancellations (
  booking_id int primary key references bookings(booking_id) on delete cascade,
  cancelled_at date not null default current_date,
  cancelled_by_user_id int null references user_accounts(account_id) on delete set null
);

create table if not exists booking_service_usages (
  booking_id int not null references bookings(booking_id) on delete cascade,
  service_id int not null,
  building_id int not null,
  provided_at date not null,
  staff_employee_id int not null,
  staff_building_id int not null,

  foreign key (service_id, building_id) references offered_services(service_id, building_id) on delete restrict,
  foreign key (staff_employee_id, staff_building_id) references employees(employee_id, building_id) on delete restrict,

  constraint booking_service_building_staff_check check (building_id = staff_building_id),
  primary key (booking_id, service_id, building_id, provided_at)
);

-- Cleanup: no-op table, kept to avoid empty migration warnings.
drop table if exists schema_migrations_dummy;

