import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { neon, drizzle } = vi.hoisted(() => ({ neon: vi.fn(), drizzle: vi.fn(() => ({})) }));
vi.mock("@neondatabase/serverless", () => ({ neon }));
vi.mock("drizzle-orm/neon-http", () => ({ drizzle }));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.stubEnv("AUTH_ENABLED", undefined);
});
afterEach(() => vi.unstubAllEnvs());

describe("database configuration boundary", () => {
  it("does not construct a client when AUTH_SECRET is missing", async () => {
    vi.stubEnv("DATABASE_URL", "postgres://synthetic.invalid/test");
    vi.stubEnv("AUTH_SECRET", undefined);
    const { getDb } = await import("@/db");
    expect(getDb).toThrow("AUTH_SECRET is required");
    expect(neon).not.toHaveBeenCalled();
  });

  it("returns null for a no-DB demo", async () => {
    vi.stubEnv("DATABASE_URL", undefined);
    vi.stubEnv("AUTH_SECRET", undefined);
    const { getDb } = await import("@/db");
    expect(getDb()).toBeNull();
    expect(neon).not.toHaveBeenCalled();
  });

  it("validates configuration even before returning a cached client", async () => {
    vi.stubEnv("DATABASE_URL", "postgres://synthetic.invalid/test");
    vi.stubEnv("AUTH_SECRET", "synthetic-secret");
    const { getDb } = await import("@/db");
    expect(getDb()).not.toBeNull();
    expect(neon).toHaveBeenCalledTimes(1);
    vi.stubEnv("AUTH_SECRET", undefined);
    expect(getDb).toThrow("AUTH_SECRET is required");
    expect(neon).toHaveBeenCalledTimes(1);
  });

  it("does not reuse a cached database client after entering no-DB demo mode", async () => {
    vi.stubEnv("DATABASE_URL", "postgres://synthetic.invalid/test");
    vi.stubEnv("AUTH_SECRET", "synthetic-secret");
    const { getDb } = await import("@/db");
    expect(getDb()).not.toBeNull();
    vi.stubEnv("DATABASE_URL", undefined);
    vi.stubEnv("AUTH_SECRET", undefined);
    vi.stubEnv("AUTH_ENABLED", "false");
    expect(getDb()).toBeNull();
    expect(neon).toHaveBeenCalledTimes(1);
  });

});
