import path from "path";
import dotenv from "dotenv";

// Load env from `server/.env` (if present) and fallback to repo root `.env`.
const serverEnvPath = path.resolve(__dirname, "..", ".env");
const rootEnvPath = path.resolve(__dirname, "..", "..", ".env");

dotenv.config({ path: serverEnvPath });
dotenv.config({ path: rootEnvPath });

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export const config = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 4000),

  db: {
    host: required("PGHOST"),
    port: Number(process.env.PGPORT ?? 5432),
    user: required("PGUSER"),
    password: required("PGPASSWORD"),
    database: required("PGDATABASE"),
  },

  jwt: {
    secret: required("JWT_SECRET"),
    accessTtlSeconds: Number(process.env.JWT_ACCESS_TTL_SECONDS ?? 43200),
  },

  security: {
    loginRateLimitWindowMs: Number(process.env.LOGIN_RATE_LIMIT_WINDOW_MS ?? 900000),
    loginRateLimitMax: Number(process.env.LOGIN_RATE_LIMIT_MAX ?? 10),
    loginFailsBeforeLock: Number(process.env.LOGIN_FAILS_BEFORE_LOCK ?? 12),
    loginLockMs: Number(process.env.LOGIN_LOCK_MS ?? 1800000),
  },

  autoMigrate: String(process.env.DB_AUTO_MIGRATE ?? "true").toLowerCase() === "true",

  bootstrapAdmin: {
    email: process.env.BOOTSTRAP_ADMIN_EMAIL ?? "admin@hotel.local",
    password: process.env.BOOTSTRAP_ADMIN_PASSWORD ?? "Admin12345!",
  },

  cors: {
    origin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
  },
};

