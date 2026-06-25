import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// Local migrations read DATABASE_URL from .env.local (same file Next.js uses).
config({ path: ".env.local" });

export default defineConfig({
  schema: "./db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
