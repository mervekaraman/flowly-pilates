import "server-only";
import { mkdirSync } from "node:fs";
import path from "node:path";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema";

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

// With DATABASE_URL (production: Supabase / Neon / any Postgres) we use node-postgres.
// Without it, an embedded Postgres (PGlite) under ./data keeps local development zero-setup.
async function createDb(): Promise<Db> {
  const url = process.env.DATABASE_URL;
  // Never fall back to the embedded demo database (public demo password) on the live site.
  if (!url && process.env.VERCEL_ENV === "production") throw new Error("DATABASE_URL canlı ortamda zorunlu.");
  if (url) {
    const [{ Pool }, { drizzle }, { poolConfig }] = await Promise.all([import("pg"), import("drizzle-orm/node-postgres"), import("./pool-config")]);
    return drizzle(new Pool(poolConfig(url)), { schema }) as unknown as Db;
  }

  const [{ PGlite }, { drizzle }, { migrate }, { seedDemoData }] = await Promise.all([
    import("@electric-sql/pglite"),
    import("drizzle-orm/pglite"),
    import("drizzle-orm/pglite/migrator"),
    import("./seed"),
  ]);
  const dataDir = path.join(process.cwd(), "data", "pglite");
  mkdirSync(dataDir, { recursive: true });
  const db = drizzle(new PGlite(dataDir), { schema });
  await migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  if (process.env.SEED_DEMO !== "false" && !process.env.VERCEL) await seedDemoData(db as unknown as Db);
  return db as unknown as Db;
}

// One instance per server process: PGlite allows a single owner of its data directory,
// and dev-server reloads must not open it twice.
const globalForDb = globalThis as unknown as { smedaDb?: Promise<Db> };

export function getDb(): Promise<Db> {
  globalForDb.smedaDb ??= createDb().catch((error) => {
    globalForDb.smedaDb = undefined;
    throw error;
  });
  return globalForDb.smedaDb;
}

export { schema };
