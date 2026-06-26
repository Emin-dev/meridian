import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// redirect() throws a control-flow signal in Next.js; model that here so the
// test can assert the guard short-circuits rather than returning.
class RedirectError extends Error {
  constructor(public url: string) {
    super("NEXT_REDIRECT");
  }
}

const redirect = vi.fn((url: string) => {
  throw new RedirectError(url);
});
const getSession = vi.fn();

vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirect(url),
}));
vi.mock("@/lib/auth", () => ({
  getSession: () => getSession(),
}));

import { requireSession } from "@/lib/require-session";

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  redirect.mockClear();
  getSession.mockReset();
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("requireSession", () => {
  it("enforces a session by default once a DB and secret are set (default-secure)", async () => {
    // The dangerous old behavior was a no-op here, leaving a connected DB with
    // real PII publicly mutable. Default-secure: with both configured and no
    // explicit opt-out, the guard must enforce.
    delete process.env.AUTH_ENABLED;
    process.env.AUTH_SECRET = "secret";
    process.env.DATABASE_URL = "postgres://x";
    getSession.mockResolvedValue(null);

    await expect(requireSession()).rejects.toThrow("NEXT_REDIRECT");
    expect(getSession).toHaveBeenCalled();
    expect(redirect).toHaveBeenCalledWith("/login");
  });

  it("is a no-op when AUTH_ENABLED=false explicitly opts an un-seeded demo out", async () => {
    process.env.AUTH_ENABLED = "false";
    process.env.AUTH_SECRET = "secret";
    process.env.DATABASE_URL = "postgres://x";

    await expect(requireSession()).resolves.toBeUndefined();
    expect(getSession).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("is a no-op when AUTH_SECRET is missing (app stays publicly demoable)", async () => {
    delete process.env.AUTH_ENABLED;
    delete process.env.AUTH_SECRET;
    process.env.DATABASE_URL = "postgres://x";

    await expect(requireSession()).resolves.toBeUndefined();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("is a no-op when DATABASE_URL is missing (no data to protect)", async () => {
    delete process.env.AUTH_ENABLED;
    process.env.AUTH_SECRET = "secret";
    delete process.env.DATABASE_URL;

    await expect(requireSession()).resolves.toBeUndefined();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("redirects to /login when enabled and there is no session", async () => {
    process.env.AUTH_ENABLED = "true";
    process.env.AUTH_SECRET = "secret";
    process.env.DATABASE_URL = "postgres://x";
    getSession.mockResolvedValue(null);

    await expect(requireSession()).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/login");
  });

  it("allows the action through when enabled and a session exists", async () => {
    process.env.AUTH_ENABLED = "true";
    process.env.AUTH_SECRET = "secret";
    process.env.DATABASE_URL = "postgres://x";
    getSession.mockResolvedValue({ userId: 1, email: "a@b.com" });

    await expect(requireSession()).resolves.toBeUndefined();
    expect(redirect).not.toHaveBeenCalled();
  });
});
