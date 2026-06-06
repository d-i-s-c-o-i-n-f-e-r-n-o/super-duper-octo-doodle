"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pool = void 0;
exports.withClient = withClient;
const pg_1 = require("pg");
const config_1 = require("../config");
exports.pool = new pg_1.Pool({
    host: config_1.config.db.host,
    port: config_1.config.db.port,
    user: config_1.config.db.user,
    password: config_1.config.db.password,
    database: config_1.config.db.database,
    // Keep it deterministic for small installations
    max: 10,
});
async function withClient(fn) {
    const client = await exports.pool.connect();
    try {
        return await fn(client);
    }
    finally {
        client.release();
    }
}
