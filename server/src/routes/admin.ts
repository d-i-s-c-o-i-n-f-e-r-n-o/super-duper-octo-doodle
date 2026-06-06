import { Router } from "express";
import { z } from "zod";
import { requireAuth, requirePermission, hashPassword } from "../lib/auth";
import { withClient } from "../lib/db";

export const adminRouter = Router();

function canManageBuilding(
  req: { auth?: { accountType: string; staff?: { buildingId: number } } },
  buildingId: number,
): boolean {
  if (!req.auth) return false;
  if (req.auth.accountType === "network_admin") return true;
  return req.auth.accountType === "hotel_staff" && req.auth.staff?.buildingId === buildingId;
}

const registerStaffSchema = z.object({
  buildingId: z.number().int().positive(),
  positionId: z.number().int().positive(),
  lastName: z.string().max(30),
  firstName: z.string().max(30),
  middleName: z.string().max(30).optional().default(""),
  passport: z.string().regex(/^[0-9]{10}$/),
  phone: z.string().regex(/^\+[0-9]{11,12}$/),
  email: z.string().email().max(120),
  password: z.string().min(8).max(200),
});

adminRouter.post("/staff/register", requireAuth, requirePermission("admin:register_staff"), async (req, res) => {
  // Network admin only (RBAC уже пропускает, но дополнительно защищаемся)
  if (req.auth?.accountType !== "network_admin") return res.status(403).json({ message: "Forbidden" });

  const parsed = registerStaffSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid input" });

  try {
    const data = parsed.data;
    const passwordHash = await hashPassword(data.password);

    const result = await withClient(async (client) => {
      // Create employee first.
      const emp = await client.query<{ employee_id: number }>(
        `
          insert into employees(building_id, position_id, last_name, first_name, middle_name, passport, phone)
          values($1, $2, $3, $4, $5, $6, $7)
          returning employee_id
        `,
        [data.buildingId, data.positionId, data.lastName, data.firstName, data.middleName, data.passport, data.phone],
      );
      if (emp.rowCount !== 1) throw new Error("Employee not created");

      const employeeId = emp.rows[0].employee_id;
      await client.query(
        `
          insert into user_accounts(email, password_hash, account_type, staff_employee_id, staff_building_id)
          values($1, $2, 'hotel_staff', $3, $4)
        `,
        [data.email.toLowerCase(), passwordHash, employeeId, data.buildingId],
      );

      return { employeeId };
    });

    return res.json({ ok: true, employeeId: result.employeeId });
  } catch {
    return res.status(500).json({ message: "Internal server error" });
  }
});

const upsertTinyNameSchema = z.string().trim().min(1).max(50);

const createBuildingSchema = z.object({
  hotelClassStars: z.number().int().min(1).max(5),
  floors: z.number().int().min(1).max(200),
  cityName: upsertTinyNameSchema,
  streetName: upsertTinyNameSchema,
  houseName: upsertTinyNameSchema,
});

const patchBuildingSchema = z.object({
  hotelClassStars: z.number().int().min(1).max(5).optional(),
  floors: z.number().int().min(1).max(200).optional(),
});

adminRouter.post("/buildings/create", requireAuth, requirePermission("hotel:manage"), async (req, res) => {
  if (req.auth?.accountType !== "network_admin") return res.status(403).json({ message: "Forbidden" });

  const parsed = createBuildingSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid input" });

  try {
    const b = parsed.data;

    const result = await withClient(async (client) => {
      const hcExists = await client.query(`select 1 from hotel_classes where stars = $1 limit 1`, [b.hotelClassStars]);
      if (hcExists.rowCount !== 1) return { ok: false as const, status: 400 as const, message: "Unknown hotel class" };

      await client.query(`insert into cities(name) values($1) on conflict (name) do nothing`, [b.cityName]);
      await client.query(`insert into streets(name) values($1) on conflict (name) do nothing`, [b.streetName]);
      await client.query(`insert into houses(name) values($1) on conflict (name) do nothing`, [b.houseName]);

      const city = await client.query<{ city_id: number }>(`select city_id from cities where name = $1 limit 1`, [b.cityName]);
      const street = await client.query<{ street_id: number }>(
        `select street_id from streets where name = $1 limit 1`,
        [b.streetName],
      );
      const house = await client.query<{ house_id: number }>(`select house_id from houses where name = $1 limit 1`, [
        b.houseName,
      ]);
      if (city.rowCount !== 1 || street.rowCount !== 1 || house.rowCount !== 1) throw new Error("lookup failed");

      const cityId = city.rows[0].city_id;
      const streetId = street.rows[0].street_id;
      const houseId = house.rows[0].house_id;

      await client.query(
        `
          insert into city_streets(city_id, street_id)
          values($1, $2)
          on conflict do nothing
        `,
        [cityId, streetId],
      );

      await client.query(
        `
          insert into city_street_houses(city_id, street_id, house_id)
          values($1, $2, $3)
          on conflict do nothing
        `,
        [cityId, streetId, houseId],
      );

      const inserted = await client.query<{ building_id: number }>(
        `
          insert into buildings(hotel_class_stars, floors, city_id, street_id, house_id)
          values($1, $2, $3, $4, $5)
          on conflict (hotel_class_stars, floors, city_id, street_id, house_id) do nothing
          returning building_id
        `,
        [b.hotelClassStars, b.floors, cityId, streetId, houseId],
      );

      let buildingId = inserted.rows[0]?.building_id;
      if (!buildingId) {
        const existing = await client.query<{ building_id: number }>(
          `
            select building_id
            from buildings
            where hotel_class_stars = $1
              and floors = $2
              and city_id = $3
              and street_id = $4
              and house_id = $5
            limit 1
          `,
          [b.hotelClassStars, b.floors, cityId, streetId, houseId],
        );
        buildingId = existing.rows[0]?.building_id;
      }

      if (!buildingId) throw new Error("building not resolved");

      await client.query(
        `
          insert into offered_services(service_id, building_id, cost)
          select s.service_id, $1,
                 case s.name
                   when 'Завтрак' then 900.00
                   when 'Ужин' then 1600.00
                   when 'Трансфер' then 2800.00
                   else 500.00
                 end::numeric(12,2)
          from services s
          where s.name in ('Завтрак','Ужин','Трансфер')
          on conflict (service_id, building_id) do nothing
        `,
        [buildingId],
      );

      return { ok: true as const, buildingId };
    });

    if (!result.ok) return res.status(result.status).json({ message: result.message });
    return res.json({ ok: true, buildingId: result.buildingId });
  } catch {
    return res.status(500).json({ message: "Internal server error" });
  }
});

adminRouter.patch("/buildings/:id", requireAuth, requirePermission("hotel:manage"), async (req, res) => {
  const id = Number(req.params.id);
  if (!canManageBuilding(req, id)) return res.status(403).json({ message: "Forbidden" });
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ message: "Invalid building id" });

  const parsed = patchBuildingSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ message: "Invalid input" });
  if (Object.keys(parsed.data).length === 0) return res.status(400).json({ message: "Nothing to update" });

  try {
    const data = parsed.data;
    await withClient(async (client) => {
      const hcStars = data.hotelClassStars;
      if (typeof hcStars === "number") {
        const hcExists = await client.query(`select 1 from hotel_classes where stars = $1 limit 1`, [hcStars]);
        if (hcExists.rowCount !== 1) throw new Error("Unknown hotel class");
      }

      const fields: string[] = [];
      const params: unknown[] = [];
      let pi = 1;
      if (typeof data.floors === "number") {
        fields.push(`floors = $${pi++}`);
        params.push(data.floors);
      }
      if (typeof data.hotelClassStars === "number") {
        fields.push(`hotel_class_stars = $${pi++}`);
        params.push(data.hotelClassStars);
      }
      params.push(id);
      const q = `update buildings set ${fields.join(", ")} where building_id = $${pi}`;
      const r = await client.query(q, params);
      if (r.rowCount !== 1) throw new Error("not found");
    });
    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ message: "Internal server error" });
  }
});

const createRoomSchema = z.object({
  buildingId: z.number().int().positive(),
  roomNumber: z.number().int().positive(),
  roomTypeId: z.number().int().positive(),
  cost: z.number().nonnegative(),
  floor: z.number().int().min(0).max(500),
});

const patchRoomSchema = z.object({
  roomTypeId: z.number().int().positive().optional(),
  cost: z.number().nonnegative().optional(),
  floor: z.number().int().min(0).max(500).optional(),
});

adminRouter.post("/rooms/create", requireAuth, requirePermission("hotel:manage"), async (req, res) => {
  const parsed = createRoomSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid input" });

  try {
    const d = parsed.data;
    if (!canManageBuilding(req, d.buildingId)) return res.status(403).json({ message: "Forbidden" });
    await withClient(async (client) => {
      const rt = await client.query(`select 1 from room_types where room_type_id = $1`, [d.roomTypeId]);
      if (rt.rowCount !== 1) throw new Error("bad room type");

      await client.query(`insert into room_number_registry(room_number) values($1) on conflict do nothing`, [d.roomNumber]);

      const ins = await client.query(
        `
          insert into rooms_in_building(building_id, room_number, room_type_id, cost, floor)
          values($1,$2,$3,$4,$5)
          on conflict (building_id, room_number) do nothing
        `,
        [d.buildingId, d.roomNumber, d.roomTypeId, d.cost, d.floor],
      );
      if (ins.rowCount !== 1) throw new Error("exists");
    });
    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ message: "Internal server error" });
  }
});

adminRouter.patch("/rooms", requireAuth, requirePermission("hotel:manage"), async (req, res) => {
  const parsed = z
    .object({
      buildingId: z.number().int().positive(),
      roomNumber: z.number().int().positive(),
      patch: patchRoomSchema,
    })
    .safeParse(req.body);

  if (!parsed.success) return res.status(400).json({ message: "Invalid input" });

  const { buildingId, roomNumber, patch } = parsed.data;
  if (Object.keys(patch).length === 0) return res.status(400).json({ message: "Nothing to update" });
  if (!canManageBuilding(req, buildingId)) return res.status(403).json({ message: "Forbidden" });

  try {
    await withClient(async (client) => {
      if (typeof patch.roomTypeId === "number") {
        const rt = await client.query(`select 1 from room_types where room_type_id = $1`, [patch.roomTypeId]);
        if (rt.rowCount !== 1) throw new Error("bad room type");
      }

      const fields: string[] = [];
      const params: unknown[] = [];
      let pi = 1;
      if (typeof patch.roomTypeId === "number") {
        fields.push(`room_type_id = $${pi++}`);
        params.push(patch.roomTypeId);
      }
      if (typeof patch.cost === "number") {
        fields.push(`cost = $${pi++}`);
        params.push(patch.cost);
      }
      if (typeof patch.floor === "number") {
        fields.push(`floor = $${pi++}`);
        params.push(patch.floor);
      }

      params.push(buildingId, roomNumber);
      const bidParam = `$${pi++}`;
      const rnParam = `$${pi++}`;
      const q = `update rooms_in_building set ${fields.join(", ")} where building_id = ${bidParam} and room_number = ${rnParam}`;
      const r = await client.query(q, params);
      if (r.rowCount !== 1) throw new Error("not found");
    });

    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ message: "Internal server error" });
  }
});

const patchOfferedServiceCostSchema = z.object({
  buildingId: z.number().int().positive().optional(),
  serviceId: z.number().int().positive(),
  cost: z.number().nonnegative(),
});

adminRouter.patch("/offered-services/cost", requireAuth, requirePermission("hotel:manage"), async (req, res) => {
  const parsed = patchOfferedServiceCostSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ message: "Invalid input" });

  const buildingId =
    req.auth?.accountType === "hotel_staff" ? req.auth.staff!.buildingId : parsed.data.buildingId;
  if (!buildingId || Number.isNaN(buildingId)) return res.status(400).json({ message: "buildingId required" });
  if (!canManageBuilding(req, buildingId)) return res.status(403).json({ message: "Forbidden" });

  try {
    await withClient(async (client) => {
      const r = await client.query(
        `
          update offered_services
          set cost = $3
          where building_id = $1 and service_id = $2
        `,
        [buildingId, parsed.data.serviceId, parsed.data.cost],
      );
      if (r.rowCount !== 1) throw new Error("not found");
    });
    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ message: "Internal server error" });
  }
});

