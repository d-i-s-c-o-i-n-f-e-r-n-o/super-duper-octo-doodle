import { Router } from "express";
import { z } from "zod";
import { requireAuth, requirePermission } from "../lib/auth";
import { withClient } from "../lib/db";

export const clientRouter = Router();

const clientCreateSchema = z.object({
  lastName: z.string().max(30),
  firstName: z.string().max(30),
  middleName: z.string().max(30).optional().default(""),
  passport: z.string().regex(/^[0-9]{10}$/),
  phone: z.string().regex(/^\+[0-9]{11,12}$/),
  email: z.string().email().max(120),
});

clientRouter.post(
  "/",
  requireAuth,
  requirePermission("clients:create"),
  async (req, res) => {
    const parsed = clientCreateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid input" });

    try {
      const data = parsed.data;
      const result = await withClient(async (client) => {
        const r = await client.query<{
          client_id: number;
          last_name: string;
          first_name: string;
          middle_name: string;
          passport: string;
          phone: string;
          email: string;
        }>(
          `
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
          `,
          [data.lastName, data.firstName, data.middleName, data.passport, data.phone, data.email.toLowerCase()],
        );
        return r.rows[0];
      });

      res.json({ client: result });
    } catch {
      res.status(500).json({ message: "Internal server error" });
    }
  },
);

clientRouter.get(
  "/lookup",
  requireAuth,
  requirePermission("clients:create"),
  async (req, res) => {
    const passport = String(req.query.passport ?? "").trim();
    const parsedPassport = z.string().regex(/^[0-9]{10}$/).safeParse(passport);
    if (!parsedPassport.success) return res.status(400).json({ message: "Invalid passport" });

    const result = await withClient(async (client) => {
      const r = await client.query<{
        client_id: number;
        last_name: string;
        first_name: string;
        middle_name: string;
        passport: string;
        phone: string;
        email: string;
      }>(
        `
          select client_id, last_name, first_name, middle_name, passport, phone, email
          from clients
          where passport = $1
          limit 1
        `,
        [passport],
      );
      return r.rowCount === 1 ? r.rows[0] : null;
    });

    return res.json({ client: result });
  },
);

