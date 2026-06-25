import { config } from "dotenv";
config({ path: ".env.local" });

import { getDb } from "./index";
import { users } from "./schema";
import { hashPassword } from "../lib/auth";
import { insertDemoData } from "./demo-data";

// Realistic Baku user accounts (used when auth is enabled via AUTH_ENABLED).
const DEMO_USERS = [
  { email: "elvin.mammadov@meridian.az", password: "Baku2026!" },
  { email: "nigar.aliyeva@meridian.az", password: "Baku2026!" },
  { email: "admin@meridian.az", password: "Admin2026!" },
];

async function main() {
  const db = getDb();
  if (!db) {
    console.log("DATABASE_URL not set — skipping seed.");
    return;
  }

  // Reset to the demo Baku user set.
  await db.delete(users);
  for (const u of DEMO_USERS) {
    const hash = await hashPassword(u.password);
    await db.insert(users).values({ email: u.email, passwordHash: hash });
    console.log("User:", u.email, " /  password:", u.password);
  }

  if (process.argv.includes("--demo")) {
    console.log("Loading small Baku demo data…");
    await insertDemoData(db);
    console.log("Baku demo data loaded: 5 contacts, 4 deals, 6 activities, 1 sequence.");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
