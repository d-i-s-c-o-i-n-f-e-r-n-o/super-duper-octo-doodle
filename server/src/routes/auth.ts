import { Router } from "express";
import { z } from "zod";
import { config } from "../config";
import { withClient } from "../lib/db";
import { requireAuth, signAccessToken, verifyPassword } from "../lib/auth";
import rateLimit from "express-rate-limit";
import crypto from "crypto";

export const authRouter = Router();

const loginSchema = z.object({
  email: z.string().email().max(120),
  password: z.string().min(8).max(200),
});

function sha256(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

const loginLimiter = rateLimit({
  windowMs: config.security.loginRateLimitWindowMs,
  max: config.security.loginRateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Unauthorized" },
});

authRouter.post("/login", loginLimiter, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid input" });

  const { email, password } = parsed.data;
  const emailNorm = email.trim().toLowerCase();

  try {
    const result = await withClient(async (client) => {
      // DB-level lock (in addition to express-rate-limit)
      const ip = req.ip ?? "unknown";
      const emailHash = sha256(emailNorm);
      const ipHash = sha256(ip);
      const now = new Date();

      const lockRow = await client.query<{ locked_until: Date | null }>(
        `
          select locked_until
          from auth_login_attempts
          where email_hash = $1 and ip_hash = $2
          limit 1
        `,
        [emailHash, ipHash],
      );

      if (lockRow.rowCount === 1 && lockRow.rows[0].locked_until && lockRow.rows[0].locked_until > now) {
        return { ok: false as const, reason: "locked" };
      }

      const user = await client.query<{
        account_id: number;
        account_type: "network_admin" | "hotel_staff";
        password_hash: string;
      }>(
        `
          select account_id, account_type, password_hash
          from user_accounts
          where lower(email) = $1
          limit 1
        `,
        [emailNorm],
      );

      if (user.rowCount !== 1) {
        // Always do an update to make timing harder and reduce enumeration.
        await client.query(
          `
            insert into auth_login_attempts(email_hash, ip_hash, fail_count, locked_until, last_failed_at)
            values($1, $2, 1, null, now())
            on conflict (email_hash, ip_hash)
            do update set
              fail_count = auth_login_attempts.fail_count + 1,
              last_failed_at = now(),
              locked_until = case
                when auth_login_attempts.fail_count + 1 >= $3 then now() + ($4::int * interval '1 millisecond')
                else auth_login_attempts.locked_until
              end
          `,
          [emailHash, ipHash, config.security.loginFailsBeforeLock, config.security.loginLockMs],
        );
        return { ok: false as const, reason: "invalid" };
      }

      const okPassword = await verifyPassword(password, user.rows[0].password_hash);
      if (!okPassword) {
        await client.query(
          `
            insert into auth_login_attempts(email_hash, ip_hash, fail_count, locked_until, last_failed_at)
            values($1, $2, 1, null, now())
            on conflict (email_hash, ip_hash)
            do update set
              fail_count = auth_login_attempts.fail_count + 1,
              last_failed_at = now(),
              locked_until = case
                when auth_login_attempts.fail_count + 1 >= $3 then now() + ($4::int * interval '1 millisecond')
                else auth_login_attempts.locked_until
              end
          `,
          [emailHash, ipHash, config.security.loginFailsBeforeLock, config.security.loginLockMs],
        );

        return { ok: false as const, reason: "invalid" };
      }

      // reset fails
      await client.query(
        `
          update auth_login_attempts
          set fail_count = 0, locked_until = null, last_failed_at = null
          where email_hash = $1 and ip_hash = $2
        `,
        [emailHash, ipHash],
      );

      const token = signAccessToken({ accountId: user.rows[0].account_id, accountType: user.rows[0].account_type });
      return {
        ok: true as const,
        token,
        accountType: user.rows[0].account_type,
        accountId: user.rows[0].account_id,
      };
    });

    if (!result.ok) return res.status(401).json({ message: "Unauthorized" });
    return res.json({ accessToken: result.token, accountType: result.accountType, accountId: result.accountId });
  } catch {
    return res.status(500).json({ message: "Internal server error" });
  }
});

authRouter.get("/me", requireAuth, async (req, res) => {
  res.json({
    accountId: req.auth!.accountId,
    accountType: req.auth!.accountType,
    staff: req.auth!.staff,
    permissions: Array.from(req.auth!.permissions),
  });
});

