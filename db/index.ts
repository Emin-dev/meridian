import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

export { schema };

/**
 * Lazily-initialised Drizzle client backed by Neon's serverless HTTP driver.
 * Returns `null` when DATABASE_URL is absent so the app still builds and serves
 * before the database is provisioned.
 */
export function getDb() {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  return drizzle(neon(url), { schema });
}
