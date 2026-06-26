import { config } from "dotenv";
config({ path: ".env.local" });
import { getDb } from "./db/index";
import { users } from "./db/schema";
import { verifyPassword } from "./lib/auth";

async function main() {
  const db = getDb();
  if (!db) { console.log("NO DB (DATABASE_URL unset)"); return; }
  const all = await db.select({ email: users.email, passwordHash: users.passwordHash }).from(users);
  console.log("user count:", all.length);
  console.log("emails:", all.map((u) => u.email).join(", ") || "(none)");
  const admin = all.find((u) => u.email === "admin@meridian.az");
  if (admin) {
    console.log("admin@meridian.az + 'Admin2026!' works:", await verifyPassword("Admin2026!", admin.passwordHash));
  } else {
    console.log("admin@meridian.az NOT FOUND");
  }
  console.log("AUTH_SECRET set:", !!process.env.AUTH_SECRET, "| DATABASE_URL set:", !!process.env.DATABASE_URL);
}
main().catch((e) => { console.error("ERR:", e.message); process.exit(1); });
