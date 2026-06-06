import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";
import { config } from "../config";
import { withClient } from "./db";

export type AccountType = "network_admin" | "hotel_staff";

export function signAccessToken(payload: { accountId: number; accountType: AccountType }): string {
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.accessTtlSeconds,
  });
}

function verifyAccessToken(token: string): { accountId: number; accountType: AccountType } {
  const decoded = jwt.verify(token, config.jwt.secret);
  if (typeof decoded !== "object" || !decoded) throw new Error("Invalid JWT payload");
  const accountId = (decoded as any).accountId;
  const accountType = (decoded as any).accountType;
  if (typeof accountId !== "number") throw new Error("Invalid JWT accountId");
  if (accountType !== "network_admin" && accountType !== "hotel_staff") throw new Error("Invalid JWT accountType");
  return { accountId, accountType };
}

async function loadPermissionsAndAuth(req: Request): Promise<void> {
  // Runs after token verification.
  if (!req.auth) return;
  // Permissions are loaded from DB for the request (simple, safe, no cross-request caching).
  const accountId = req.auth.accountId;
  await withClient(async (client) => {
    const perms = await client.query<{ code: string }>(
      `
        select p.code
        from position_permissions pp
        join permissions p on p.permission_id = pp.permission_id
        where pp.position_id = $1
      `,
      [req.auth!.staff?.positionId ?? -1],
    );

    const permSet = new Set<string>();
    for (const row of perms.rows) permSet.add(row.code);
    req.auth!.permissions = permSet;
  });
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const authHeader = req.header("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const token = authHeader.slice("Bearer ".length);
    const { accountId, accountType } = verifyAccessToken(token);

    req.auth = {
      accountId,
      accountType,
      staff: undefined,
      permissions: new Set<string>(),
    };

    // Load staff binding if needed.
    if (accountType === "hotel_staff") {
      await withClient(async (client) => {
        const r = await client.query<{
          staff_employee_id: number;
          staff_building_id: number;
          position_id: number;
          position_name: string;
          account_type: string;
        }>(
          `
            select ua.staff_employee_id, ua.staff_building_id, e.position_id, p.name as position_name, ua.account_type
            from user_accounts ua
            join employees e on e.employee_id = ua.staff_employee_id and e.building_id = ua.staff_building_id
            join positions p on p.position_id = e.position_id
            where ua.account_id = $1 and ua.account_type = 'hotel_staff'
          `,
          [accountId],
        );

        if (r.rowCount !== 1) throw new Error("Account not found");
        req.auth!.staff = {
          employeeId: r.rows[0].staff_employee_id,
          buildingId: r.rows[0].staff_building_id,
          positionId: r.rows[0].position_id,
          positionName: r.rows[0].position_name,
        };
      });
    }

    // Permissions for network_admin: all. For staff: from DB.
    if (accountType === "network_admin") {
      req.auth.permissions = new Set<string>(["*"]); // sentinel for admin
    } else {
      await loadPermissionsAndAuth(req);
    }

    next();
  } catch {
    res.status(401).json({ message: "Unauthorized" });
  }
}

export function requirePermission(permission: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.auth) return res.status(401).json({ message: "Unauthorized" });
      const perms = req.auth.permissions;
      if (!perms) return res.status(403).json({ message: "Forbidden" });
      if (perms.has("*")) return next();
      if (perms.has(permission)) return next();
      return res.status(403).json({ message: "Forbidden" });
    } catch {
      return res.status(403).json({ message: "Forbidden" });
    }
  };
}

export function hashPassword(password: string): Promise<string> {
  const bcrypt = require("bcryptjs") as typeof import("bcryptjs");
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  const bcrypt = require("bcryptjs") as typeof import("bcryptjs");
  return bcrypt.compare(password, passwordHash);
}

