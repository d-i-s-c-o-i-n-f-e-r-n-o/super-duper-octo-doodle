"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bookingRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const auth_1 = require("../lib/auth");
const db_1 = require("../lib/db");
exports.bookingRouter = (0, express_1.Router)();
const dateStr = zod_1.z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .transform((s) => new Date(`${s}T00:00:00.000Z`));
const clientRefSchema = zod_1.z.object({
    lastName: zod_1.z.string().max(30),
    firstName: zod_1.z.string().max(30),
    middleName: zod_1.z.string().max(30).optional().default(""),
    phone: zod_1.z.string().regex(/^\+[0-9]{11,12}$/),
    email: zod_1.z.string().email().max(120),
});
const bookingCreateSchema = zod_1.z.object({
    // For hotel staff only passport is enough; details are used only when client doesn't exist.
    passport: zod_1.z.string().regex(/^[0-9]{10}$/),
    client: clientRefSchema.optional(),
    roomNumber: zod_1.z.number().int().positive(),
    checkIn: dateStr,
    checkOut: dateStr,
    prepaymentDeadline: dateStr,
    buildingId: zod_1.z.number().int().positive().optional(),
});
const cancelSchema = zod_1.z.object({
    cancelledAt: dateStr.optional(),
});
const bookingServiceSchema = zod_1.z.object({
    serviceId: zod_1.z.number().int().positive(),
    providedAt: dateStr.optional(),
});
function getEffectiveBuildingId(req, payloadBuildingId) {
    var _a;
    if (((_a = req.auth) === null || _a === void 0 ? void 0 : _a.accountType) === "hotel_staff")
        return req.auth.staff.buildingId;
    if (typeof payloadBuildingId === "number")
        return payloadBuildingId;
    return undefined;
}
function getTodayUtcDateOnly() {
    const d = new Date();
    return new Date(d.toISOString().slice(0, 10) + "T00:00:00.000Z");
}
exports.bookingRouter.post("/create", auth_1.requireAuth, (0, auth_1.requirePermission)("booking:create"), async (req, res) => {
    var _a;
    const parsed = bookingCreateSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ message: "Invalid input" });
    try {
        if (!((_a = req.auth) === null || _a === void 0 ? void 0 : _a.staff))
            return res.status(403).json({ message: "Forbidden" });
        const data = parsed.data;
        const buildingId = getEffectiveBuildingId(req, data.buildingId);
        if (!buildingId || Number.isNaN(buildingId))
            return res.status(400).json({ message: "Invalid buildingId" });
        // RBAC: if client doesn't exist we may need clients:create permission.
        const canCreateClient = req.auth.permissions.has("clients:create");
        const result = await (0, db_1.withClient)(async (client) => {
            var _a;
            // Validate room belongs to the building.
            const room = await client.query(`
            select room_number, room_type_id, cost::text as cost, floor
            from rooms_in_building
            where building_id = $1 and room_number = $2
            limit 1
          `, [buildingId, data.roomNumber]);
            if (room.rowCount !== 1)
                return { ok: false, status: 404, message: "Room not found" };
            // Check dates quickly.
            const checkIn = data.checkIn;
            const checkOut = data.checkOut;
            if (checkOut.getTime() < checkIn.getTime())
                return { ok: false, status: 400, message: "Invalid dates" };
            // Prepayment deadline must be within logical bounds.
            const prepayment = data.prepaymentDeadline;
            const today = new Date();
            const todayUtc = new Date(today.toISOString().slice(0, 10) + "T00:00:00.000Z");
            if (prepayment.getTime() < todayUtc.getTime()) {
                return { ok: false, status: 400, message: "Invalid prepayment deadline" };
            }
            if (prepayment.getTime() > checkOut.getTime()) {
                return { ok: false, status: 400, message: "Invalid prepayment deadline" };
            }
            // Prevent double-booking overlapping date ranges for the same room.
            const activeOverlap = await client.query(`
          select exists(
            select 1
            from bookings b
            left join booking_cancellations c on c.booking_id = b.booking_id
            left join booking_actual_checkouts co on co.booking_id = b.booking_id
            where b.booking_building_id = $1
              and b.room_number = $2
              and c.booking_id is null
              and b.check_in <= $3
              and coalesce(co.checked_out_at, b.check_out) >= $4
          ) as exists
        `, [buildingId, data.roomNumber, checkOut, checkIn]);
            if ((_a = activeOverlap.rows[0]) === null || _a === void 0 ? void 0 : _a.exists) {
                return { ok: false, status: 409, message: "Room already booked for selected dates" };
            }
            // Find or create client.
            const clientRow = await client.query(`
            select client_id
            from clients
            where passport = $1
            limit 1
          `, [data.passport]);
            let clientId;
            if (clientRow.rowCount === 1) {
                clientId = clientRow.rows[0].client_id;
            }
            else {
                if (!canCreateClient)
                    return { ok: false, status: 403, message: "Forbidden: cannot create guest" };
                if (!data.client)
                    return { ok: false, status: 400, message: "Client data required" };
                const ins = await client.query(`
              insert into clients(last_name, first_name, middle_name, passport, phone, email)
              values($1,$2,$3,$4,$5,$6)
              returning client_id
            `, [data.client.lastName, data.client.firstName, data.client.middleName, data.passport, data.client.phone, data.client.email.toLowerCase()]);
                clientId = ins.rows[0].client_id;
            }
            // Create booking (staff always belongs to the same building).
            const insBooking = await client.query(`
            insert into bookings(
              client_id,
              check_in,
              check_out,
              prepayment_deadline,
              created_staff_employee_id,
              created_staff_building_id,
              booking_building_id,
              room_number
            )
            values($1,$2,$3,$4,$5,$6,$7,$8)
            returning booking_id
          `, [
                clientId,
                data.checkIn,
                data.checkOut,
                data.prepaymentDeadline,
                req.auth.staff.employeeId,
                buildingId,
                buildingId,
                data.roomNumber,
            ]);
            return { ok: true, bookingId: insBooking.rows[0].booking_id };
        });
        if (!result.ok)
            return res.status(result.status).json({ message: result.message });
        return res.json({ ok: true, bookingId: result.bookingId });
    }
    catch {
        return res.status(500).json({ message: "Internal server error" });
    }
});
exports.bookingRouter.post("/:id/cancel", auth_1.requireAuth, (0, auth_1.requirePermission)("booking:cancel"), async (req, res) => {
    var _a, _b;
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0)
        return res.status(400).json({ message: "Invalid booking id" });
    const parsed = cancelSchema.safeParse((_a = req.body) !== null && _a !== void 0 ? _a : {});
    if (!parsed.success)
        return res.status(400).json({ message: "Invalid input" });
    try {
        if (!((_b = req.auth) === null || _b === void 0 ? void 0 : _b.staff))
            return res.status(403).json({ message: "Forbidden" });
        const cancelledAt = parsed.data.cancelledAt ? parsed.data.cancelledAt : new Date();
        const buildingId = req.auth.staff.buildingId;
        const cancelledByUserId = req.auth.accountId;
        const result = await (0, db_1.withClient)(async (client) => {
            var _a;
            const checkoutExists = await client.query(`
            select count(*)::int as cnt
            from booking_actual_checkouts co
            join bookings b on b.booking_id = co.booking_id
            where b.booking_id = $1 and b.booking_building_id = $2
          `, [id, buildingId]);
            if (((_a = checkoutExists.rows[0]) === null || _a === void 0 ? void 0 : _a.cnt) > 0) {
                return { ok: false, status: 409, message: "Already checked out" };
            }
            const exists = await client.query(`
            select count(*)::int as cnt
            from booking_cancellations c
            join bookings b on b.booking_id = c.booking_id
            where b.booking_id = $1 and b.booking_building_id = $2
          `, [id, buildingId]);
            if (exists.rows[0].cnt > 0)
                return { ok: false, status: 409, message: "Already cancelled" };
            const r = await client.query(`
            insert into booking_cancellations(booking_id, cancelled_at, cancelled_by_user_id)
            select b.booking_id, $3::date, $4
            from bookings b
            where b.booking_id = $1 and b.booking_building_id = $2
            limit 1
            returning booking_id
          `, [id, buildingId, cancelledAt, cancelledByUserId]);
            if (r.rowCount !== 1)
                return { ok: false, status: 404, message: "Not found" };
            return { ok: true };
        });
        if (!result.ok)
            return res.status(result.status).json({ message: result.message });
        return res.json({ ok: true });
    }
    catch {
        return res.status(500).json({ message: "Internal server error" });
    }
});
exports.bookingRouter.post("/lookup", auth_1.requireAuth, (0, auth_1.requirePermission)("booking:cancel"), async (req, res) => {
    var _a, _b;
    const schema = zod_1.z
        .object({
        bookingId: zod_1.z.number().int().positive().optional(),
        passport: zod_1.z.string().regex(/^[0-9]{10}$/).optional(),
    })
        .refine((v) => Boolean(v.bookingId) || Boolean(v.passport), { message: "bookingId or passport required" });
    const parsed = schema.safeParse((_a = req.body) !== null && _a !== void 0 ? _a : {});
    if (!parsed.success)
        return res.status(400).json({ message: "Invalid input" });
    try {
        const buildingId = ((_b = req.auth) === null || _b === void 0 ? void 0 : _b.accountType) === "hotel_staff" ? req.auth.staff.buildingId : null;
        const { bookingId, passport } = parsed.data;
        const bookings = await (0, db_1.withClient)(async (client) => {
            const params = [];
            const whereParts = [];
            if (bookingId) {
                whereParts.push(`b.booking_id = $${params.length + 1}`);
                params.push(bookingId);
            }
            if (passport) {
                whereParts.push(`cl.passport = $${params.length + 1}`);
                params.push(passport);
            }
            if (buildingId) {
                whereParts.push(`b.booking_building_id = $${params.length + 1}`);
                params.push(buildingId);
            }
            // Only active bookings (not cancelled, not checked out).
            whereParts.push(`canc.booking_id is null`);
            whereParts.push(`co.booking_id is null`);
            const sql = `
          select
            b.booking_id,
            b.check_in::text as check_in,
            b.check_out::text as check_out,
            b.prepayment_deadline::text as prepayment_deadline,

            cl.client_id,
            cl.last_name as client_last_name,
            cl.first_name as client_first_name,
            cl.middle_name as client_middle_name,
            cl.passport as client_passport,
            cl.phone as client_phone,
            cl.email as client_email,

            b.booking_building_id as building_id,

            bu.floors,
            hc.stars as hotel_class_stars,
            hc.name as hotel_class_name,
            ci.name as city_name,
            st.name as street_name,
            ho.name as house_name,

            r.room_number,
            r.cost::text as room_cost,
            r.floor as room_floor,
            rt.room_type_id,
            rt.name as room_type_name,
            rt.capacity as room_capacity,

            e.employee_id as created_employee_id,
            e.last_name as created_last_name,
            e.first_name as created_first_name,
            e.middle_name as created_middle_name,

            canc.cancelled_at::text as cancelled_at,
            co.checked_out_at::text as checked_out_at
          from bookings b
          join clients cl on cl.client_id = b.client_id
          join rooms_in_building r on r.building_id = b.booking_building_id and r.room_number = b.room_number
          join room_types rt on rt.room_type_id = r.room_type_id
          join buildings bu on bu.building_id = b.booking_building_id
          join hotel_classes hc on hc.stars = bu.hotel_class_stars
          join cities ci on ci.city_id = bu.city_id
          join streets st on st.street_id = bu.street_id
          join houses ho on ho.house_id = bu.house_id
          join employees e on e.employee_id = b.created_staff_employee_id and e.building_id = b.created_staff_building_id
          left join booking_cancellations canc on canc.booking_id = b.booking_id
          left join booking_actual_checkouts co on co.booking_id = b.booking_id
          where ${whereParts.join(" and ")}
          order by b.check_in desc
          limit 10
        `;
            const rows = await client.query(sql, params);
            const list = rows.rows;
            if (list.length === 0)
                return { bookings: [], additionalServicesByBookingId: {} };
            const ids = list.map((x) => x.booking_id);
            const servicesRows = await client.query(`
            select
              u.booking_id,
              u.provided_at::text as provided_at,
              u.service_id,
              s.name as service_name,
              os.cost::text as cost,
              e.last_name as employee_last_name,
              e.first_name as employee_first_name,
              e.middle_name as employee_middle_name
            from booking_service_usages u
            join services s on s.service_id = u.service_id
            join offered_services os on os.service_id = u.service_id and os.building_id = u.building_id
            join employees e on e.employee_id = u.staff_employee_id and e.building_id = u.staff_building_id
            where u.booking_id = any($1::int[])
            order by u.provided_at desc
          `, [ids]);
            const map = {};
            for (const row of servicesRows.rows) {
                const key = row.booking_id;
                let bucket = map[key];
                if (!bucket) {
                    bucket = [];
                    map[key] = bucket;
                }
                bucket.push({
                    providedAt: row.provided_at,
                    service: { id: row.service_id, name: row.service_name },
                    cost: row.cost,
                    providedBy: {
                        lastName: row.employee_last_name,
                        firstName: row.employee_first_name,
                        middleName: row.employee_middle_name,
                    },
                });
            }
            return { bookings: list, additionalServicesByBookingId: map };
        });
        const response = bookings.bookings.map((b) => {
            var _a;
            return ({
                booking: {
                    id: b.booking_id,
                    checkIn: b.check_in,
                    checkOut: b.check_out,
                    prepaymentDeadline: b.prepayment_deadline,
                    isCancelled: Boolean(b.cancelled_at),
                    cancelledAt: b.cancelled_at,
                    isCheckedOut: Boolean(b.checked_out_at),
                    checkedOutAt: b.checked_out_at,
                    client: {
                        id: b.client_id,
                        lastName: b.client_last_name,
                        firstName: b.client_first_name,
                        middleName: b.client_middle_name,
                        passport: b.client_passport,
                        phone: b.client_phone,
                        email: b.client_email,
                    },
                    room: {
                        roomNumber: b.room_number,
                        cost: b.room_cost,
                        floor: b.room_floor,
                        capacity: b.room_capacity,
                        type: { id: b.room_type_id, name: b.room_type_name },
                    },
                    building: {
                        id: b.building_id,
                        floors: b.floors,
                        hotelClass: { stars: b.hotel_class_stars, name: b.hotel_class_name },
                        address: { city: b.city_name, street: b.street_name, house: b.house_name },
                    },
                    createdBy: {
                        employeeId: b.created_employee_id,
                        lastName: b.created_last_name,
                        firstName: b.created_first_name,
                        middleName: b.created_middle_name,
                    },
                },
                additionalServices: (_a = bookings.additionalServicesByBookingId[b.booking_id]) !== null && _a !== void 0 ? _a : [],
            });
        });
        return res.json({ bookings: response });
    }
    catch {
        return res.status(500).json({ message: "Internal server error" });
    }
});
exports.bookingRouter.get("/upcoming", auth_1.requireAuth, (0, auth_1.requirePermission)("booking:upcoming"), async (req, res) => {
    var _a, _b, _c;
    const rawDays = Array.isArray(req.query.days) ? req.query.days[0] : req.query.days;
    const parsed = Number.parseInt(String((rawDays !== null && rawDays !== void 0 ? rawDays : "7")).trim(), 10);
    if (Number.isNaN(parsed) || parsed <= 0)
        return res.status(400).json({ message: "Invalid days" });
    const days = Math.max(1, Math.min(30, parsed));
    try {
        const buildingId = ((_a = req.auth) === null || _a === void 0 ? void 0 : _a.accountType) === "hotel_staff" ? (_c = (_b = req.auth.staff) === null || _b === void 0 ? void 0 : _b.buildingId) !== null && _c !== void 0 ? _c : null : null;
        //const buildingId = req.auth?.accountType === "hotel_staff" ? req.auth.staff!.buildingId : null;
        const today = getTodayUtcDateOnly();
        const start = today.toISOString().slice(0, 10);
        const endDate = new Date(today.getTime());
        endDate.setUTCDate(endDate.getUTCDate() + (days - 1));
        const end = endDate.toISOString().slice(0, 10);
        const result = await (0, db_1.withClient)(async (client) => {
            const params = [start, end];
            const where = [];
            where.push(`canc.booking_id is null`);
            where.push(`co.booking_id is null`);
            if (buildingId) {
                where.push(`b.booking_building_id = $3`);
                params.push(buildingId);
            }
            const sql = `
          select
            b.booking_id,
            b.booking_building_id,
            b.check_in::text as check_in,
            b.check_out::text as check_out,
            r.room_number,
            r.floor as room_floor,
            rt.name as room_type_name,
            cl.last_name as client_last_name,
            cl.first_name as client_first_name,
            cl.middle_name as client_middle_name
          from bookings b
          join rooms_in_building r on r.building_id = b.booking_building_id and r.room_number = b.room_number
          join room_types rt on rt.room_type_id = r.room_type_id
          join clients cl on cl.client_id = b.client_id
          left join booking_cancellations canc on canc.booking_id = b.booking_id
          left join booking_actual_checkouts co on co.booking_id = b.booking_id
          where ${where.join(" and ")}
            and b.check_in <= $2
            and coalesce(co.checked_out_at, b.check_out) >= $1
          order by r.floor, r.room_number
        `;
            return client.query(sql, params);
        });
        return res.json({ start, end, bookings: result.rows });
    }
    catch {
        return res.status(500).json({ message: "Internal server error" });
    }
});
exports.bookingRouter.get("/occupancy", auth_1.requireAuth, (0, auth_1.requirePermission)("booking:occupancy"), async (_req, res) => {
    var _a;
    try {
        const buildingId = ((_a = _req.auth) === null || _a === void 0 ? void 0 : _a.accountType) === "hotel_staff" ? _req.auth.staff.buildingId : null;
        const today = getTodayUtcDateOnly().toISOString().slice(0, 10);
        const result = await (0, db_1.withClient)(async (client) => {
            const params = [today, today];
            const where = [];
            where.push(`canc.booking_id is null`);
            where.push(`co.booking_id is null`);
            if (buildingId) {
                where.push(`b.booking_building_id = $3`);
                params.push(buildingId);
            }
            const sql = `
          select
            r.floor as floor,
            r.room_number as room_number,
            rt.name as room_type_name,
            cl.last_name as last_name,
            cl.first_name as first_name,
            cl.middle_name as middle_name,
            b.booking_id as booking_id
          from bookings b
          join rooms_in_building r on r.building_id = b.booking_building_id and r.room_number = b.room_number
          join room_types rt on rt.room_type_id = r.room_type_id
          join clients cl on cl.client_id = b.client_id
          left join booking_cancellations canc on canc.booking_id = b.booking_id
          left join booking_actual_checkouts co on co.booking_id = b.booking_id
          where ${where.join(" and ")}
            and b.check_in <= $1
            and b.check_out >= $2
          order by r.floor, r.room_number
        `;
            return client.query(sql, params);
        });
        const floors = {};
        for (const row of result.rows) {
            const f = row.floor;
            if (!floors[f])
                floors[f] = [];
            floors[f].push({
                roomNumber: row.room_number,
                bookingId: row.booking_id,
                fio: `${row.last_name} ${row.first_name} ${row.middle_name}`.trim(),
                roomTypeName: row.room_type_name,
            });
        }
        return res.json({ floors });
    }
    catch {
        return res.status(500).json({ message: "Internal server error" });
    }
});
exports.bookingRouter.get("/checkout/eligible", auth_1.requireAuth, (0, auth_1.requirePermission)("booking:checkout"), async (req, res) => {
    var _a, _b;
    try {
        const buildingId = ((_a = req.auth) === null || _a === void 0 ? void 0 : _a.accountType) === "hotel_staff" ? req.auth.staff.buildingId : null;
        const today = getTodayUtcDateOnly().toISOString().slice(0, 10);
        const rows = await (0, db_1.withClient)(async (client) => {
            const params = [today, today];
            const where = [];
            where.push(`canc.booking_id is null`);
            where.push(`co.booking_id is null`);
            if (buildingId) {
                where.push(`b.booking_building_id = $3`);
                params.push(buildingId);
            }
            const sql = `
          select
            b.booking_id,
            b.check_out::text as check_out,
            r.room_number,
            rt.name as room_type_name,
            cl.last_name as last_name,
            cl.first_name as first_name,
            cl.middle_name as middle_name,
            r.cost::text as room_cost
          from bookings b
          join rooms_in_building r on r.building_id = b.booking_building_id and r.room_number = b.room_number
          join room_types rt on rt.room_type_id = r.room_type_id
          join clients cl on cl.client_id = b.client_id
          left join booking_cancellations canc on canc.booking_id = b.booking_id
          left join booking_actual_checkouts co on co.booking_id = b.booking_id
          where ${where.join(" and ")}
            and b.check_in <= $1
            and b.check_out >= $2
          order by r.floor, r.room_number
        `;
            return client.query(sql, params);
        });
        const bookingIds = rows.rows.map((r) => r.booking_id);
        const services = bookingIds.length
            ? await (0, db_1.withClient)(async (client) => {
                return client.query(`
                select u.booking_id, sum(os.cost)::text as cost
                from booking_service_usages u
                join offered_services os on os.service_id = u.service_id and os.building_id = u.building_id
                where u.booking_id = any($1::int[])
                group by u.booking_id
              `, [bookingIds]);
            })
            : { rows: [] };
        const servicesMap = {};
        for (const s of services.rows)
            servicesMap[s.booking_id] = (_b = s.cost) !== null && _b !== void 0 ? _b : "0";
        const result = rows.rows.map((r) => {
            var _a;
            return ({
                bookingId: r.booking_id,
                checkOut: r.check_out,
                roomNumber: r.room_number,
                roomTypeName: r.room_type_name,
                fio: `${r.last_name} ${r.first_name} ${r.middle_name}`.trim(),
                roomCost: r.room_cost,
                servicesTotalCost: (_a = servicesMap[r.booking_id]) !== null && _a !== void 0 ? _a : "0",
            });
        });
        return res.json({ eligible: result });
    }
    catch {
        return res.status(500).json({ message: "Internal server error" });
    }
});
exports.bookingRouter.post("/:id/checkout", auth_1.requireAuth, (0, auth_1.requirePermission)("booking:checkout"), async (req, res) => {
    var _a;
    const bookingId = Number(req.params.id);
    if (!Number.isFinite(bookingId) || bookingId <= 0)
        return res.status(400).json({ message: "Invalid booking id" });
    try {
        if (!((_a = req.auth) === null || _a === void 0 ? void 0 : _a.staff))
            return res.status(403).json({ message: "Forbidden" });
        const buildingId = req.auth.staff.buildingId;
        const byAccountId = req.auth.accountId;
        const result = await (0, db_1.withClient)(async (client) => {
            const r = await client.query(`
            insert into booking_actual_checkouts(booking_id, checked_out_by_account_id, checked_out_at)
            select b.booking_id, $3, current_date
            from bookings b
            left join booking_cancellations c on c.booking_id = b.booking_id
            left join booking_actual_checkouts co on co.booking_id = b.booking_id
            where b.booking_id = $1
              and b.booking_building_id = $2
              and c.booking_id is null
              and co.booking_id is null
              and b.check_in <= current_date
              and b.check_out >= current_date
            returning booking_id
          `, [bookingId, buildingId, byAccountId]);
            return r.rowCount === 1 ? { ok: true } : { ok: false };
        });
        if (!result.ok)
            return res.status(409).json({ message: "Unable to checkout booking" });
        return res.json({ ok: true });
    }
    catch {
        return res.status(500).json({ message: "Internal server error" });
    }
});
exports.bookingRouter.post("/:id/services", auth_1.requireAuth, (0, auth_1.requirePermission)("booking:service:add"), async (req, res) => {
    var _a, _b, _c;
    const bookingId = Number(req.params.id);
    if (!Number.isFinite(bookingId) || bookingId <= 0)
        return res.status(400).json({ message: "Invalid booking id" });
    const parsed = bookingServiceSchema.safeParse((_a = req.body) !== null && _a !== void 0 ? _a : {});
    if (!parsed.success)
        return res.status(400).json({ message: "Invalid input" });
    try {
        if (!((_b = req.auth) === null || _b === void 0 ? void 0 : _b.staff))
            return res.status(403).json({ message: "Forbidden" });
        const buildingId = req.auth.staff.buildingId;
        const staffEmployeeId = req.auth.staff.employeeId;
        const providedAt = (_c = parsed.data.providedAt) !== null && _c !== void 0 ? _c : new Date();
        const serviceId = parsed.data.serviceId;
        const result = await (0, db_1.withClient)(async (client) => {
            // Ensure booking belongs to this building and is not cancelled.
            const bookingOk = await client.query(`
            select exists(
              select 1
              from bookings b
              left join booking_cancellations c on c.booking_id = b.booking_id
              where b.booking_id = $1
                and b.booking_building_id = $2
                and c.booking_id is null
                and not exists (select 1 from booking_actual_checkouts co where co.booking_id = b.booking_id)
            ) as ok
          `, [bookingId, buildingId]);
            if (!bookingOk.rows[0].ok)
                return { ok: false, status: 409, message: "Booking not active" };
            // Ensure offered service exists in this building.
            const offered = await client.query(`
            select service_id
            from offered_services
            where building_id = $1 and service_id = $2
            limit 1
          `, [buildingId, serviceId]);
            if (offered.rowCount !== 1)
                return { ok: false, status: 404, message: "Service not offered in this building" };
            const ins = await client.query(`
            insert into booking_service_usages(
              booking_id,
              service_id,
              building_id,
              provided_at,
              staff_employee_id,
              staff_building_id
            )
            values($1,$2,$3,$4,$5,$6)
            on conflict do nothing
            returning provided_at
          `, [bookingId, serviceId, buildingId, providedAt, staffEmployeeId, buildingId]);
            if (ins.rowCount !== 1)
                return { ok: false, status: 409, message: "Service already added for this date" };
            return { ok: true, providedAt: ins.rows[0].provided_at };
        });
        if (!result.ok)
            return res.status(result.status).json({ message: result.message });
        return res.json({ ok: true, providedAt: result.providedAt });
    }
    catch {
        return res.status(500).json({ message: "Internal server error" });
    }
});
// Must be registered after static paths like /upcoming, /occupancy, /checkout/eligible.
exports.bookingRouter.get("/:id", auth_1.requireAuth, (0, auth_1.requirePermission)("booking:view"), async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0)
        return res.status(400).json({ message: "Invalid booking id" });
    try {
        const staffBuildingId = req.auth.accountType === "hotel_staff" ? req.auth.staff.buildingId : undefined;
        const result = await (0, db_1.withClient)(async (client) => {
            await client.query(`
            insert into booking_cancellations(booking_id, cancelled_at, cancelled_by_user_id)
            select b.booking_id, current_date, null
            from bookings b
            where b.booking_id = $1
              and b.prepayment_deadline < current_date
              and not exists (select 1 from booking_cancellations c where c.booking_id = b.booking_id)
              and not exists (select 1 from booking_actual_checkouts co where co.booking_id = b.booking_id)
              ${staffBuildingId ? "and b.booking_building_id = $2" : ""}
          `, staffBuildingId ? [id, staffBuildingId] : [id]);
            const bookingQuery = await client.query(`
            select b.booking_id,
                   b.check_in::text as check_in,
                   b.check_out::text as check_out,
                   b.prepayment_deadline::text as prepayment_deadline,
                   cl.client_id,
                   cl.last_name as client_last_name,
                   cl.first_name as client_first_name,
                   cl.middle_name as client_middle_name,
                   cl.passport as client_passport,
                   cl.phone as client_phone,
                   cl.email as client_email,
                   bu.building_id,
                   bu.floors,
                   hc.stars as hotel_class_stars,
                   hc.name as hotel_class_name,
                   ci.name as city_name,
                   st.name as street_name,
                   ho.name as house_name,
                   r.room_number,
                   r.cost::text as room_cost,
                   r.floor as room_floor,
                   rt.room_type_id,
                   rt.name as room_type_name,
                   rt.capacity as room_capacity,
                   e.employee_id as created_employee_id,
                   e.last_name as created_last_name,
                   e.first_name as created_first_name,
                   e.middle_name as created_middle_name,
                   canc.cancelled_at::text as cancelled_at,
                   co.checked_out_at::text as checked_out_at
            from bookings b
            join clients cl on cl.client_id = b.client_id
            join rooms_in_building r on r.building_id = b.booking_building_id and r.room_number = b.room_number
            join room_types rt on rt.room_type_id = r.room_type_id
            join buildings bu on bu.building_id = b.booking_building_id
            join hotel_classes hc on hc.stars = bu.hotel_class_stars
            join cities ci on ci.city_id = bu.city_id
            join streets st on st.street_id = bu.street_id
            join houses ho on ho.house_id = bu.house_id
            join employees e on e.employee_id = b.created_staff_employee_id and e.building_id = b.created_staff_building_id
            left join booking_cancellations canc on canc.booking_id = b.booking_id
            left join booking_actual_checkouts co on co.booking_id = b.booking_id
            where b.booking_id = $1
              ${staffBuildingId ? "and b.booking_building_id = $2" : ""}
          `, staffBuildingId ? [id, staffBuildingId] : [id]);
            if (bookingQuery.rowCount !== 1)
                return { ok: false, status: 404, message: "Not found" };
            const services = await client.query(`
            select u.provided_at::text as provided_at,
                   u.service_id,
                   s.name as service_name,
                   os.cost::text as cost,
                   e.last_name as employee_last_name,
                   e.first_name as employee_first_name,
                   e.middle_name as employee_middle_name
            from booking_service_usages u
            join services s on s.service_id = u.service_id
            join offered_services os on os.service_id = u.service_id and os.building_id = u.building_id
            join employees e on e.employee_id = u.staff_employee_id and e.building_id = u.staff_building_id
            where u.booking_id = $1
            order by u.provided_at desc
          `, [id]);
            return { ok: true, booking: bookingQuery.rows[0], services: services.rows };
        });
        if (!result.ok)
            return res.status(result.status).json({ message: result.message });
        return res.json({
            booking: {
                id: result.booking.booking_id,
                checkIn: result.booking.check_in,
                checkOut: result.booking.check_out,
                prepaymentDeadline: result.booking.prepayment_deadline,
                isCancelled: Boolean(result.booking.cancelled_at),
                cancelledAt: result.booking.cancelled_at,
                isCheckedOut: Boolean(result.booking.checked_out_at),
                checkedOutAt: result.booking.checked_out_at,
                client: {
                    id: result.booking.client_id,
                    lastName: result.booking.client_last_name,
                    firstName: result.booking.client_first_name,
                    middleName: result.booking.client_middle_name,
                    passport: result.booking.client_passport,
                    phone: result.booking.client_phone,
                    email: result.booking.client_email,
                },
                room: {
                    roomNumber: result.booking.room_number,
                    cost: result.booking.room_cost,
                    floor: result.booking.room_floor,
                    capacity: result.booking.room_capacity,
                    type: { id: result.booking.room_type_id, name: result.booking.room_type_name },
                },
                building: {
                    id: result.booking.building_id,
                    floors: result.booking.floors,
                    hotelClass: {
                        stars: result.booking.hotel_class_stars,
                        name: result.booking.hotel_class_name,
                    },
                    address: {
                        city: result.booking.city_name,
                        street: result.booking.street_name,
                        house: result.booking.house_name,
                    },
                },
                createdBy: {
                    employeeId: result.booking.created_employee_id,
                    lastName: result.booking.created_last_name,
                    firstName: result.booking.created_first_name,
                    middleName: result.booking.created_middle_name,
                },
            },
            additionalServices: result.services.map((s) => ({
                providedAt: s.provided_at,
                service: { id: s.service_id, name: s.service_name },
                cost: s.cost,
                providedBy: {
                    lastName: s.employee_last_name,
                    firstName: s.employee_first_name,
                    middleName: s.employee_middle_name,
                },
            })),
        });
    }
    catch {
        return res.status(500).json({ message: "Internal server error" });
    }
});
