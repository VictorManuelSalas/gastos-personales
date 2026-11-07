import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

// Un solo pool por proceso (en desarrollo, Next recarga módulos y crearía varios).
const globalForDb = globalThis as unknown as { __gpPool?: Pool };

export const pool =
  globalForDb.__gpPool ??
  new Pool({ connectionString: process.env.DATABASE_URL, max: 10 });

if (process.env.NODE_ENV !== "production") globalForDb.__gpPool = pool;

export const db = drizzle(pool, { schema });

export * from "./schema";
export { schema };
