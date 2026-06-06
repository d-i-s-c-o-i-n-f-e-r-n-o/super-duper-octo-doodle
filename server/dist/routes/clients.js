"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.clientRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const auth_1 = require("../lib/auth");
const db_1 = require("../lib/db");
exports.clientRouter = (0, express_1.Router)();
const clientCreateSchema = zod_1.z.object({
    lastName: zod_1.z.string().max(30),
    firstName: zod_1.z.string().max(30),
    middleName: zod_1.z.string().max(30).optional().default(""),
    passport: zod_1.z.string().regex(/^[0-9]{10}$/),
    phone: zod_1.z.string().regex(/^\+[0-9]{11,12}$/),
    email: zod_1.z.string().email().max(120),
});
exports.clientRouter.post("/", auth_1.requireAuth, (0, auth_1.requirePermission)("clients:create"), async (req, res) => {
    const parsed = clientCreateSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ message: "Invalid input" });
    try {
        const data = parsed.data;
        const result = await (0, db_1.withClient)(async (client) => {
            const r = await client.query(`
            insert into clients(last_name, first_name, middle_name, passport, phone, email)
            values($1,$2,$3,$4,$5,$6)
            on conflict (passport)
            do update set
              last_name = excluded.last_name,
              first_name = excluded.first_name,
              middle_name = excluded.middle_name,
              phone = excluded.phone,
              email = excluded.email
            returning client_id, last_name, first_name, middle_name, passport, phone, email
          `, [data.lastName, data.firstName, data.middleName, data.passport, data.phone, data.email.toLowerCase()]);
            return r.rows[0];
        });
        res.json({ client: result });
    }
    catch {
        res.status(500).json({ message: "Internal server error" });
    }
});
exports.clientRouter.get("/lookup", auth_1.requireAuth, (0, auth_1.requirePermission)("clients:create"), async (req, res) => {
    var _a;
    const passport = String((_a = req.query.passport) !== null && _a !== void 0 ? _a : "").trim();
    const parsedPassport = zod_1.z.string().regex(/^[0-9]{10}$/).safeParse(passport);
    if (!parsedPassport.success)
        return res.status(400).json({ message: "Invalid passport" });
    const result = await (0, db_1.withClient)(async (client) => {
        const r = await client.query(`
          select client_id, last_name, first_name, middle_name, passport, phone, email
          from clients
          where passport = $1
          limit 1
        `, [passport]);
        return r.rowCount === 1 ? r.rows[0] : null;
    });
    return res.json({ client: result });
});
