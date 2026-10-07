import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthConfigurationError, isAuthEnabled } from "@/lib/auth-config";

afterEach(() => vi.unstubAllEnvs());

describe("authentication configuration", () => {
  it.each([
    { database: undefined, secret: undefined, enabled: false },
    { database: undefined, secret: "synthetic-secret", enabled: false },
    { database: "postgres://synthetic.invalid/test", secret: undefined, enabled: "error" },
    { database: "postgres://synthetic.invalid/test", secret: "synthetic-secret", enabled: true },
  ])("DB=$database, secret=$secret -> $enabled", ({ database, secret, enabled }) => {
    vi.stubEnv("DATABASE_URL", database);
    vi.stubEnv("AUTH_SECRET", secret);
    vi.stubEnv("AUTH_ENABLED", undefined);
    if (enabled === "error") {
      expect(isAuthEnabled).toThrow(AuthConfigurationError);
    } else {
      expect(isAuthEnabled()).toBe(enabled);
    }
  });

  it.each([undefined, "synthetic-secret"])("preserves an explicit no-DB demo (secret=%s)", (secret) => {
    vi.stubEnv("DATABASE_URL", undefined);
    vi.stubEnv("AUTH_SECRET", secret);
    vi.stubEnv("AUTH_ENABLED", "false");
    expect(isAuthEnabled()).toBe(false);
  });

  it.each([undefined, "synthetic-secret"])("rejects a DB-connected demo opt-out (secret=%s)", (secret) => {
    vi.stubEnv("DATABASE_URL", "postgres://synthetic.invalid/test");
    vi.stubEnv("AUTH_SECRET", secret);
    vi.stubEnv("AUTH_ENABLED", "false");
    expect(isAuthEnabled).toThrow(AuthConfigurationError);
  });

  it.each(["", " ", "\n\t"])("rejects a blank signing secret", (secret) => {
    vi.stubEnv("DATABASE_URL", "postgres://synthetic.invalid/test");
    vi.stubEnv("AUTH_SECRET", secret);
    vi.stubEnv("AUTH_ENABLED", undefined);
    expect(isAuthEnabled).toThrow(AuthConfigurationError);
  });
});
