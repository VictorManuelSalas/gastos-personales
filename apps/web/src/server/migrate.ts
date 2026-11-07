import path from "node:path";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db } from "@gp/db";

export async function runMigrations() {
  const migrationsFolder =
    process.env.MIGRATIONS_DIR ?? path.resolve(process.cwd(), "../../packages/db/drizzle");
  await migrate(db, { migrationsFolder });
  console.log(`[db] migraciones al día (${migrationsFolder})`);
}
