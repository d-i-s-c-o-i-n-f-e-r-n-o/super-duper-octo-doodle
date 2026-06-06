-- Без DO-блока: массовые вставки для расширения данных (типов комнат, номеров, услуг, клиентов, сотрудников, броней и т.д.)

-- 1) Типы комнат
INSERT INTO room_types(name, capacity)
VALUES
  ('Эконом', 1),
  ('Стандарт', 2),
  ('Стандарт+ (увеличенная кровать)', 2),
  ('Семейный', 4),
  ('Сьют', 2),
  ('Люкс с кухней', 3),
  ('Делюкс', 2),
  ('Пентхаус', 6),
  ('Апартамент-студия', 2),
  ('Комфорт', 3),
  ('Бизнес', 2),
  ('Двухкомнатный', 4)
ON CONFLICT (name) DO NOTHING;

-- 2) Реестр номеров
INSERT INTO room_number_registry(room_number)
SELECT rn FROM unnest(ARRAY[
  101,102,103,104,105,106,107,108,109,110,
  111,112,113,114,115,116,117,118,119,120,
  121,122,123,124,125,126,127,128,129,130,
  131,132,133,134,135,136,137,138,139,140,
  201,202,203,204,205,206,207,208,209,210,
  301,302,303,304,305,306,307,308,309,310
]) AS rn
ON CONFLICT DO NOTHING;

-- 3) Заполнение rooms_in_building для первого available building
INSERT INTO rooms_in_building(building_id, room_number, room_type_id, cost, floor)
SELECT b.building_id, rn.room_number, rt.room_type_id,
       (CASE
         WHEN rn.room_number BETWEEN 101 AND 110 THEN 2500.00
         WHEN rn.room_number BETWEEN 111 AND 130 THEN 4200.00
         WHEN rn.room_number BETWEEN 131 AND 140 THEN 4800.00
         WHEN rn.room_number BETWEEN 201 AND 210 THEN 6500.00
         WHEN rn.room_number BETWEEN 301 AND 310 THEN 15000.00
         ELSE 5000.00
       END)::numeric(12,2) AS cost,
       (CASE
         WHEN rn.room_number >= 300 THEN 10
         WHEN rn.room_number >= 200 THEN 2
         WHEN rn.room_number >= 130 THEN 3
         ELSE 1
       END) AS floor
FROM (SELECT building_id FROM buildings LIMIT 1) b
JOIN room_number_registry rn ON rn.room_number IN (
  101,102,103,104,105,106,107,108,109,110,
  111,112,113,114,115,116,117,118,119,120,
  121,122,123,124,125,126,127,128,129,130,
  131,132,133,134,135,136,137,138,139,140,
  201,202,203,204,205,206,207,208,209,210,
  301,302,303,304,305,306,307,308,309,310
)
JOIN room_types rt ON rt.name =
  CASE
    WHEN rn.room_number BETWEEN 101 AND 110 THEN 'Эконом'
    WHEN rn.room_number BETWEEN 111 AND 130 THEN 'Стандарт'
    WHEN rn.room_number BETWEEN 131 AND 140 THEN 'Стандарт+ (увеличенная кровать)'
    WHEN rn.room_number BETWEEN 201 AND 210 THEN 'Комфорт'
    WHEN rn.room_number BETWEEN 301 AND 310 THEN 'Пентхаус'
    ELSE 'Стандарт'
  END
ON CONFLICT (building_id, room_number) DO NOTHING;

-- 4) Услуги
INSERT INTO services(name)
VALUES
  ('Завтрак'),
  ('Ужин'),
  ('Трансфер'),
  ('Прачечная'),
  ('SPA-процедура'),
  ('Ранний заезд'),
  ('Поздний выезд'),
  ('Аренда конференц-зала'),
  ('Экскурсия по городу'),
  ('Детское кресло'),
  ('Услуги няни'),
  ('Прокат автомобиля'),
  ('Массаж в номере'),
  ('Пожарочный комплект'),
  ('Минибар (разовый)'),
  ('Сейф в номере')
ON CONFLICT (name) DO NOTHING;

-- 5) Привязка услуг к первому building
INSERT INTO offered_services(service_id, building_id, cost)
SELECT s.service_id, b.building_id,
       (CASE s.name
         WHEN 'Завтрак' THEN 1200.00
         WHEN 'Ужин' THEN 2000.00
         WHEN 'Трансфер' THEN 3500.00
         WHEN 'Прачечная' THEN 800.00
         WHEN 'SPA-процедура' THEN 4500.00
         WHEN 'Ранний заезд' THEN 1000.00
         WHEN 'Поздний выезд' THEN 1200.00
         WHEN 'Аренда конференц-зала' THEN 15000.00
         WHEN 'Экскурсия по городу' THEN 5000.00
         WHEN 'Детское кресло' THEN 300.00
         WHEN 'Услуги няни' THEN 2000.00
         WHEN 'Прокат автомобиля' THEN 5000.00
         WHEN 'Массаж в номере' THEN 3500.00
         WHEN 'Пожарочный комплект' THEN 50.00
         WHEN 'Минибар (разовый)' THEN 700.00
         WHEN 'Сейф в номере' THEN 200.00
         ELSE 1000.00 END)::numeric(12,2)
FROM services s CROSS JOIN (SELECT building_id FROM buildings LIMIT 1) b
ON CONFLICT (service_id, building_id) DO NOTHING;

-- 6) Позиции
INSERT INTO positions(name) VALUES ('Ресепшионист') ON CONFLICT (name) DO NOTHING;
INSERT INTO positions(name) VALUES ('Менеджер') ON CONFLICT (name) DO NOTHING;

-- 7) Сотрудники: вставляем с конкретными паспортами (serial employee_id будет назначен автоматически)
INSERT INTO employees(building_id, position_id, last_name, first_name, middle_name, passport, phone)
SELECT b.building_id, p.position_id, 'Калинин', 'Игорь', 'Андреевич', '0000000001', '89991234567'
FROM (SELECT building_id FROM buildings LIMIT 1) b
JOIN positions p ON p.name='Ресепшионист'
ON CONFLICT (employee_id, building_id) DO NOTHING;

INSERT INTO employees(building_id, position_id, last_name, first_name, middle_name, passport, phone)
SELECT b.building_id, p.position_id, 'Лебедев', 'Максим', 'Олегович', '0000000002', '89997654321'
FROM (SELECT building_id FROM buildings LIMIT 1) b
JOIN positions p ON p.name='Менеджер'
ON CONFLICT (employee_id, building_id) DO NOTHING;

-- 8) 40 клиентов с нетривиальными ФИО (паспорт 10 цифр, телефон 8 + 10 цифр, почты из разрешённых доменов)
INSERT INTO clients(last_name, first_name, middle_name, passport, phone, email)
VALUES
  ('Князев-Бородин', 'Фёдор', 'Игнатьевич', '0123456789', '89110000001', 'f.knyazev@outlook.com'),
  ('Зорькин', 'Ярослав', 'Миронович', '1029384756', '89110000002', 'yar.zorkin@gmail.com'),
  ('Рождественская', 'Валерия', 'Сергеевна', '5647382910', '89110000003', 'val.roz@mail.ru'),
  ('Гребенщиков', 'Семен-Олег', 'Петрович', '9988776655', '89110000004', 's.geb@internet.ru'),
  ('Шаповалова', 'Евдокия', 'Дмитриевна', '2233445566', '89110000005', 'eve.shap@yandex.ru'),
  ('Мальцев', 'Платон', 'Алексеевич', '3344556677', '89110000006', 'pl.maltsev@gmail.com'),
  ('Уварова-Петухова', 'Оксана', 'Романовна', '4455667788', '89110000007', 'oks.uvarova@outlook.com'),
  ('Назаров', 'Ростислав', 'Богданович', '5566778899', '89110000008', 'rost.naz@mail.ru'),
  ('Воронин', 'Арсений', 'Пантелеймонович', '6677889900', '89110000009', 'ars.vor@internet.ru'),
  ('Семицветова', 'Злата', 'Игоревна', '7788990011', '89110000010', 'z.semitsvetova@yandex.ru'),
  ('Белозёров', 'Герасим', 'Павлович', '8899001122', '89110000011', 'ger.beloz@gmail.com'),
  ('Кирпичников', 'Леонид', 'Федорович', '9900112233', '89110000012', 'leo.kirp@mail.ru'),
  ('Орлов-Ростов', 'Алиса', 'Матвеевна', '1010101010', '89110000013', 'alisa.orlov@outlook.com'),
  ('Дубровская', 'Ника', 'Станиславовна', '1212121212', '89110000014', 'nika.dub@mail.ru'),
  ('Широков', 'Борислав', 'Мирославович', '1313131313', '89110000015', 'bor.shirok@internet.ru'),
  ('Горбачёва', 'Ксения', 'Андреевна', '1414141414', '89110000016', 'ks.gorb@yandex.ru'),
  ('Луговой', 'Евгений', 'Валерьевич', '1515151515', '89110000017', 'ev.lugovoy@gmail.com'),
  ('Панфилова', 'Таисия', 'Радионовна', '1616161616', '89110000018', 'ta.pan@mail.ru'),
  ('Вяземский', 'Тихон', 'Аркадьевич', '1717171717', '89110000019', 't.vyaz@yandex.ru'),
  ('Калмыкова', 'Снежанна', 'Фёдоровна', '1818181818', '89110000020', 'sn.kalm@outlook.com'),
  ('Ярошенко', 'Роман', 'Никитич', '1919191919', '89110000021', 'roman.yar@gmail.com'),
  ('Ивченко-Рудь', 'Марта', 'Сергеевна', '2020202020', '89110000022', 'm.ivchenko@mail.ru'),
  ('Скворцов', 'Пантелеймон', 'Кириллович', '2121212121', '89110000023', 'pant.skv@internet.ru'),
  ('Гусельникова', 'Эльвира', 'Вячеславовна', '2323232323', '89110000024', 'el.gusel@yandex.ru'),
  ('Котовский', 'Эмиль', 'Николаевич', '2424242424', '89110000025', 'em.kotov@gmail.com'),
  ('Филин', 'Виргиний', 'Ильинич', '2525252525', '89110000026', 'vir.fil@mail.ru'),
  ('Баженова', 'Капитолина', 'Игнатьевна', '2626262626', '89110000027', 'kap.bazh@outlook.com'),
  ('Морозов-Невский', 'Емельян', 'Петрович', '2727272727', '89110000028', 'em.moroz@mail.ru'),
  ('Прохорова', 'Влада', 'Макаровна', '2828282828', '89110000029', 'vl.prok@internet.ru'),
  ('Ратников', 'Олег', 'Витальевич', '2929292929', '89110000030', 'oleg.rat@yandex.ru'),
  ('Кошелева', 'Павлина', 'Александровна', '3030303030', '89110000031', 'pav.kos@mail.ru'),
  ('Дьяков', 'Эдуард', 'Станиславович', '3131313131', '89110000032', 'edu.dyak@outlook.com'),
  ('Бутынская', 'Люцина', 'Ростиславовна', '3232323232', '89110000033', 'luc.but@mail.ru'),
  ('Чарушин', 'Глеб', 'Тимофеевич', '3333333333', '89110000034', 'gleb.char@gmail.com'),
  ('Михайловская', 'Адель', 'Назаровна', '3434343434', '89110000035', 'adel.mih@yandex.ru'),
  ('Ермаков', 'Захар', 'Платонович', '3535353535', '89110000036', 'zakh.erm@mail.ru'),
  ('Платонова', 'Сабина', 'Робертовна', '3636363636', '89110000037', 'sab.plat@internet.ru'),
  ('Суханов', 'Остап', 'Евгеньевич', '3737373737', '89110000038', 'ost.suh@outlook.com')
ON CONFLICT (passport) DO NOTHING;

-- 9) ~50 броней: используем generate_series для массовой генерации записей
--    Логика дат: первые 18 — прошлые, 19..34 — текущие/около текущей, 35..50 — будущие.
INSERT INTO bookings(client_id, check_in, check_out, prepayment_deadline,
                      created_staff_employee_id, created_staff_building_id,
                      booking_building_id, room_number)
SELECT
  c.client_id,
  (current_date + (CASE WHEN gs.i <= 18 THEN -(gs.i % 10) - 1 WHEN gs.i <= 34 THEN (gs.i % 3) - 1 ELSE (gs.i % 20) + 2 END))::date AS check_in,
  (current_date + (CASE WHEN gs.i <= 18 THEN -(gs.i % 10) - 1 WHEN gs.i <= 34 THEN (gs.i % 3) - 1 ELSE (gs.i % 20) + 2 END) + ((gs.i % 7) + 1))::date AS check_out,
  (current_date + (CASE WHEN gs.i <= 18 THEN -(gs.i % 10) - 2 WHEN gs.i <= 34 THEN (gs.i % 3) - 2 ELSE (gs.i % 20) + 1 END))::date AS prepayment_deadline,
  (CASE WHEN (gs.i % 2)=0 THEN (SELECT e.employee_id FROM employees e WHERE e.passport='0000000002' LIMIT 1) ELSE (SELECT e.employee_id FROM employees e WHERE e.passport='0000000001' LIMIT 1) END) AS created_staff_employee_id,
  b.building_id AS created_staff_building_id,
  b.building_id as booking_building_id,
  r.room_number
FROM generate_series(1,50) AS gs(i)
CROSS JOIN (SELECT building_id FROM buildings LIMIT 1) b
-- выбираем клиента циклически
JOIN LATERAL (
  SELECT client_id FROM (
    SELECT client_id, row_number() OVER (ORDER BY client_id) rn FROM clients
  ) t WHERE ((gs.i - 1) % (SELECT count(*) FROM clients)) + 1 = t.rn
) c ON true
-- выбираем комнату циклически из rooms_in_building данного здания
JOIN LATERAL (
  SELECT room_number FROM (
    SELECT room_number, row_number() OVER (ORDER BY room_number) rn FROM rooms_in_building WHERE building_id = b.building_id
  ) tr WHERE ((gs.i - 1) % (SELECT count(*) FROM rooms_in_building WHERE building_id = b.building_id)) + 1 = tr.rn
) r ON true
ON CONFLICT DO NOTHING;

-- 10) Добавим использования услуг для части броней (разные даты, разные услуги)
INSERT INTO booking_service_usages(booking_id, service_id, building_id, provided_at, staff_employee_id, staff_building_id)
SELECT b.booking_id, s.service_id, b.booking_building_id,
       (b.check_in + ((b.booking_id % 3)::int))::date,
       (CASE WHEN (b.booking_id % 2)=0 THEN (SELECT e.employee_id FROM employees e WHERE e.passport='0000000002' LIMIT 1) ELSE (SELECT e.employee_id FROM employees e WHERE e.passport='0000000001' LIMIT 1) END),
       b.booking_building_id
FROM bookings b
JOIN offered_services s ON s.building_id = b.booking_building_id
WHERE b.booking_id IS NOT NULL
  AND (b.booking_id % 2) = 0
LIMIT 80
ON CONFLICT DO NOTHING;

-- 11) Отменим несколько прошлых броней (6 штук) через booking_cancellations
INSERT INTO booking_cancellations(booking_id, cancelled_at, cancelled_by_user_id)
SELECT b.booking_id, (b.check_in - 1)::date, NULL
FROM bookings b
WHERE b.check_in < current_date
ORDER BY b.booking_id
LIMIT 6
ON CONFLICT DO NOTHING;
