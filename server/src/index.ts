import { createApp } from "./app";
import { applyMigrations } from "./lib/migrations";
import { config } from "./config";
import { withClient } from "./lib/db";
import { hashPassword } from "./lib/auth";

async function bootstrap() {
  if (config.autoMigrate) {
    await applyMigrations();
  }

  // Create bootstrap admin user if DB is empty.
  await withClient(async (client) => {
    const r = await client.query<{ cnt: number }>("select count(*)::int as cnt from user_accounts");
    if (r.rows[0]?.cnt === 0) {
      const email = config.bootstrapAdmin.email;
      const passwordHash = await hashPassword(config.bootstrapAdmin.password);
      await client.query(
        `
          insert into user_accounts(email, password_hash, account_type)
          values($1, $2, 'network_admin')
        `,
        [email, passwordHash],
      );
    }
  });

  const app = createApp();
  app.listen(config.port, () => {
    // eslint-disable-next-line no-console
    console.log(`HotelWebApp API listening on port ${config.port}`);
  });
}

bootstrap().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});

