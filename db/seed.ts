import { config } from "dotenv";
config({ path: ".env.local" });

import { eq } from "drizzle-orm";
import { getDb } from "./index";
import { users } from "./schema";
import { hashPassword } from "../lib/auth";

async function main() {
  const db = getDb();
  if (!db) {
    console.log("DATABASE_URL not set — skipping seed.");
    return;
  }

  const email = process.env.SEED_EMAIL ?? "admin@meridian.local";
  const password = process.env.SEED_PASSWORD ?? "changeme";

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existing) {
    console.log("Seed user already exists:", email);
    return;
  }

  const hash = await hashPassword(password);
  await db.insert(users).values({ email, passwordHash: hash });
  console.log("Created seed user:", email);
  console.log("  Email:   ", email);
  console.log("  Password:", password);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
