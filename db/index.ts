import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

export { schema };

const _mk = (url: string) => drizzle(neon(url), { schema });
type Db = ReturnType<typeof _mk>;

let _db: Db | null | undefined;

/**
 * Lazily-initialised Drizzle client backed by Neon's serverless HTTP driver.
 * Cached as a module singleton so a new HTTP client is not created per call.
 * Returns `null` when DATABASE_URL is absent so the app still builds and serves
 * before the database is provisioned.
 */
export function getDb(): Db | null {
  if (_db !== undefined) return _db;
  const url = process.env.DATABASE_URL;
  _db = url ? _mk(url) : null;
  return _db;
}
