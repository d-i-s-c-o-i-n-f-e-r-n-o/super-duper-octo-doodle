"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const config_1 = require("../config");
const db_1 = require("../lib/db");
const auth_1 = require("../lib/auth");
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const crypto_1 = __importDefault(require("crypto"));
exports.authRouter = (0, express_1.Router)();
const loginSchema = zod_1.z.object({
    email: zod_1.z.string().email().max(120),
    password: zod_1.z.string().min(8).max(200),
});
function sha256(input) {
    return crypto_1.default.createHash("sha256").update(input).digest("hex");
}
const loginLimiter = (0, express_rate_limit_1.default)({
    windowMs: config_1.config.security.loginRateLimitWindowMs,
    max: config_1.config.security.loginRateLimitMax,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Unauthorized" },
});
exports.authRouter.post("/login", loginLimiter, async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ message: "Invalid input" });
    const { email, password } = parsed.data;
    const emailNorm = email.trim().toLowerCase();
    try {
        const result = await (0, db_1.withClient)(async (client) => {
            var _a;
            // DB-level lock (in addition to express-rate-limit)
            const ip = (_a = req.ip) !== null && _a !== void 0 ? _a : "unknown";
            const emailHash = sha256(emailNorm);
            const ipHash = sha256(ip);
            const now = new Date();
            const lockRow = await client.query(`
          select locked_until
          from auth_login_attempts
          where email_hash = $1 and ip_hash = $2
          limit 1
        `, [emailHash, ipHash]);
            if (lockRow.rowCount === 1 && lockRow.rows[0].locked_until && lockRow.rows[0].locked_until > now) {
                return { ok: false, reason: "locked" };
            }
            const user = await client.query(`
          select account_id, account_type, password_hash
          from user_accounts
          where lower(email) = $1
          limit 1
        `, [emailNorm]);
            if (user.rowCount !== 1) {
                // Always do an update to make timing harder and reduce enumeration.
                await client.query(`
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
          `, [emailHash, ipHash, config_1.config.security.loginFailsBeforeLock, config_1.config.security.loginLockMs]);
                return { ok: false, reason: "invalid" };
            }
            const okPassword = await (0, auth_1.verifyPassword)(password, user.rows[0].password_hash);
            if (!okPassword) {
                await client.query(`
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
          `, [emailHash, ipHash, config_1.config.security.loginFailsBeforeLock, config_1.config.security.loginLockMs]);
                return { ok: false, reason: "invalid" };
            }
            // reset fails
            await client.query(`
          update auth_login_attempts
          set fail_count = 0, locked_until = null, last_failed_at = null
          where email_hash = $1 and ip_hash = $2
        `, [emailHash, ipHash]);
            const token = (0, auth_1.signAccessToken)({ accountId: user.rows[0].account_id, accountType: user.rows[0].account_type });
            return {
                ok: true,
                token,
                accountType: user.rows[0].account_type,
                accountId: user.rows[0].account_id,
            };
        });
        if (!result.ok)
            return res.status(401).json({ message: "Unauthorized" });
        return res.json({ accessToken: result.token, accountType: result.accountType, accountId: result.accountId });
    }
    catch {
        return res.status(500).json({ message: "Internal server error" });
    }
});
exports.authRouter.get("/me", auth_1.requireAuth, async (req, res) => {
    res.json({
        accountId: req.auth.accountId,
        accountType: req.auth.accountType,
        staff: req.auth.staff,
        permissions: Array.from(req.auth.permissions),
    });
});
