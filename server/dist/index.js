"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = require("./app");
const migrations_1 = require("./lib/migrations");
const config_1 = require("./config");
const db_1 = require("./lib/db");
const auth_1 = require("./lib/auth");
async function bootstrap() {
    if (config_1.config.autoMigrate) {
        await (0, migrations_1.applyMigrations)();
    }
    // Create bootstrap admin user if DB is empty.
    await (0, db_1.withClient)(async (client) => {
        var _a;
        const r = await client.query("select count(*)::int as cnt from user_accounts");
        if (((_a = r.rows[0]) === null || _a === void 0 ? void 0 : _a.cnt) === 0) {
            const email = config_1.config.bootstrapAdmin.email;
            const passwordHash = await (0, auth_1.hashPassword)(config_1.config.bootstrapAdmin.password);
            await client.query(`
          insert into user_accounts(email, password_hash, account_type)
          values($1, $2, 'network_admin')
        `, [email, passwordHash]);
        }
    });
    const app = (0, app_1.createApp)();
    app.listen(config_1.config.port, () => {
        // eslint-disable-next-line no-console
        console.log(`HotelWebApp API listening on port ${config_1.config.port}`);
    });
}
bootstrap().catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
});
