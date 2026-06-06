"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyMigrations = applyMigrations;
const promises_1 = require("fs/promises");
const path_1 = __importDefault(require("path"));
const db_1 = require("./db");
function getMigrationId(fileName) {
    const m = fileName.match(/^(\d+)_.*\.sql$/i);
    if (!m)
        return null;
    return Number(m[1]);
}
async function applyMigrations() {
    // Allow running without migrations in some environments.
    const env = process.env.DB_AUTO_MIGRATE;
    const enabled = String(env !== null && env !== void 0 ? env : "true").toLowerCase() === "true";
    if (!enabled)
        return;
    // __dirname in compiled JS: server/dist/lib
    //  -> go up to repo root, then into db/migrations
    const migrationsDir = path_1.default.resolve(__dirname, "..", "..", "..", "db", "migrations");
    const files = await (0, promises_1.readdir)(migrationsDir);
    const migrations = files
        .map((f) => ({ file: f, id: getMigrationId(f) }))
        .filter((x) => x.id !== null)
        .sort((a, b) => a.id - b.id);
    if (migrations.length === 0)
        return;
    await (0, db_1.withClient)(async (client) => {
        await client.query(`
      create table if not exists schema_migrations (
        id integer primary key,
        applied_at timestamptz not null default now()
      );
    `);
        for (const mig of migrations) {
            const already = await client.query(`select id from schema_migrations where id = $1 limit 1`, [mig.id]);
            if (already.rowCount && already.rowCount > 0)
                continue;
            const sql = await (0, promises_1.readFile)(path_1.default.join(migrationsDir, mig.file), "utf8");
            await client.query("begin");
            try {
                await client.query(sql);
                await client.query(`insert into schema_migrations(id) values($1)`, [mig.id]);
                await client.query("commit");
            }
            catch (e) {
                await client.query("rollback");
                throw e;
            }
        }
    });
}
