import type { PoolConfig } from "pg";
import { SUPABASE_ROOT_CA } from "./supabase-ca";

// Connection settings for a hosted Postgres (Supabase etc.). Traffic to a remote database is
// always encrypted; local databases (CI, docker) connect without TLS. Serverless functions keep
// few connections each because the provider's pooler multiplexes them.
let warned = false;

/**
 * The server certificate is always verified for Supabase (its public root CA ships with the app),
 * or for any host whose CA is given in DATABASE_CA_CERT, so nobody in between can pose as the
 * database. An unverified connection is refused on the live site and only allowed (with a
 * warning) elsewhere, e.g. a self-hosted test database.
 */
function tlsOptions(host: string) {
  const ca = process.env.DATABASE_CA_CERT?.replace(/\\n/g, "\n").trim() || (host.endsWith(".supabase.com") ? SUPABASE_ROOT_CA : "");
  if (ca) return { ca, rejectUnauthorized: true };
  if (process.env.VERCEL_ENV === "production") throw new Error("Veritabanı sertifikası doğrulanamıyor: DATABASE_CA_CERT gerekli.");
  if (!warned) {
    warned = true;
    console.warn("[veritabanı] DATABASE_CA_CERT tanımlı değil: bağlantı şifreli ama sunucu sertifikası doğrulanmıyor.");
  }
  return { rejectUnauthorized: false };
}

export function poolConfig(connectionString: string, max = 3): PoolConfig {
  const host = (() => {
    try {
      return new URL(connectionString).hostname;
    } catch {
      return "";
    }
  })();
  const local = ["localhost", "127.0.0.1", "::1", ""].includes(host) || process.env.DATABASE_SSL === "disable";
  const url = new URL(connectionString);
  // pg treats `sslmode=require` as full CA verification; the `ssl` option below decides instead.
  url.searchParams.delete("sslmode");
  return {
    connectionString: url.toString(),
    max,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
    ssl: local ? undefined : tlsOptions(host),
  };
}
