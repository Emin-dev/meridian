import { config } from "dotenv";
config({ path: ".env.local" });

import { getDb } from "./index";
import { users } from "./schema";
import { hashPassword } from "../lib/auth";
import { insertDemoData } from "./demo-data";

// Realistic Baku user accounts (used when auth is enabled via AUTH_ENABLED).
// Passwords are overridable via env so a real deployment can rotate them
// without editing code — the hardcoded values are demo-only fallbacks. Set
// SEED_USER_PASSWORD / SEED_ADMIN_PASSWORD before seeding any non-demo DB.
const usingDefaultUserPw = !process.env.SEED_USER_PASSWORD;
const usingDefaultAdminPw = !process.env.SEED_ADMIN_PASSWORD;
const USER_PASSWORD = process.env.SEED_USER_PASSWORD ?? "Baku2026!";
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "Admin2026!";

const DEMO_USERS = [
  { email: "elvin.mammadov@meridian.az", password: USER_PASSWORD },
  { email: "nigar.aliyeva@meridian.az", password: USER_PASSWORD },
  { email: "admin@meridian.az", password: ADMIN_PASSWORD },
];

async function main() {
  const db = getDb();
  if (!db) {
    console.log("DATABASE_URL not set — skipping seed.");
    return;
  }

  if (usingDefaultUserPw || usingDefaultAdminPw) {
    console.warn(
      "⚠️  Seeding with DEFAULT demo passwords. Set SEED_USER_PASSWORD and " +
        "SEED_ADMIN_PASSWORD to rotate credentials before any real deployment."
    );
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
