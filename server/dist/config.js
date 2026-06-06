"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const path_1 = __importDefault(require("path"));
const dotenv_1 = __importDefault(require("dotenv"));
// Load env from `server/.env` (if present) and fallback to repo root `.env`.
const serverEnvPath = path_1.default.resolve(__dirname, "..", ".env");
const rootEnvPath = path_1.default.resolve(__dirname, "..", "..", ".env");
dotenv_1.default.config({ path: serverEnvPath });
dotenv_1.default.config({ path: rootEnvPath });
function required(name) {
    const v = process.env[name];
    if (!v)
        throw new Error(`Missing required env var: ${name}`);
    return v;
}
exports.config = {
    nodeEnv: (_a = process.env.NODE_ENV) !== null && _a !== void 0 ? _a : "development",
    port: Number((_b = process.env.PORT) !== null && _b !== void 0 ? _b : 4000),
    db: {
        host: required("PGHOST"),
        port: Number((_c = process.env.PGPORT) !== null && _c !== void 0 ? _c : 5432),
        user: required("PGUSER"),
        password: required("PGPASSWORD"),
        database: required("PGDATABASE"),
    },
    jwt: {
        secret: required("JWT_SECRET"),
        accessTtlSeconds: Number((_d = process.env.JWT_ACCESS_TTL_SECONDS) !== null && _d !== void 0 ? _d : 43200),
    },
    security: {
        loginRateLimitWindowMs: Number((_e = process.env.LOGIN_RATE_LIMIT_WINDOW_MS) !== null && _e !== void 0 ? _e : 900000),
        loginRateLimitMax: Number((_f = process.env.LOGIN_RATE_LIMIT_MAX) !== null && _f !== void 0 ? _f : 10),
        loginFailsBeforeLock: Number((_g = process.env.LOGIN_FAILS_BEFORE_LOCK) !== null && _g !== void 0 ? _g : 12),
        loginLockMs: Number((_h = process.env.LOGIN_LOCK_MS) !== null && _h !== void 0 ? _h : 1800000),
    },
    autoMigrate: String((_j = process.env.DB_AUTO_MIGRATE) !== null && _j !== void 0 ? _j : "true").toLowerCase() === "true",
    bootstrapAdmin: {
        email: (_k = process.env.BOOTSTRAP_ADMIN_EMAIL) !== null && _k !== void 0 ? _k : "admin@hotel.local",
        password: (_l = process.env.BOOTSTRAP_ADMIN_PASSWORD) !== null && _l !== void 0 ? _l : "Admin12345!",
    },
    cors: {
        origin: (_m = process.env.CORS_ORIGIN) !== null && _m !== void 0 ? _m : "http://localhost:5173",
    },
};
