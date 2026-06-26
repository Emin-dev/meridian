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
  it("is a no-op when AUTH_ENABLED is not 'true' (default-open)", async () => {
    delete process.env.AUTH_ENABLED;
    process.env.AUTH_SECRET = "secret";
    process.env.DATABASE_URL = "postgres://x";

    await expect(requireSession()).resolves.toBeUndefined();
    expect(getSession).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("is a no-op when AUTH_SECRET is missing even with AUTH_ENABLED=true", async () => {
    process.env.AUTH_ENABLED = "true";
    delete process.env.AUTH_SECRET;
    process.env.DATABASE_URL = "postgres://x";

    await expect(requireSession()).resolves.toBeUndefined();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("is a no-op when DATABASE_URL is missing even with AUTH_ENABLED=true", async () => {
    process.env.AUTH_ENABLED = "true";
    process.env.AUTH_SECRET = "secret";
    delete process.env.DATABASE_URL;

    await expect(requireSession()).resolves.toBeUndefined();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("redirects to /login when fully enabled and there is no session", async () => {
    process.env.AUTH_ENABLED = "true";
    process.env.AUTH_SECRET = "secret";
    process.env.DATABASE_URL = "postgres://x";
    getSession.mockResolvedValue(null);

    await expect(requireSession()).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/login");
  });

  it("allows the action through when fully enabled and a session exists", async () => {
    process.env.AUTH_ENABLED = "true";
    process.env.AUTH_SECRET = "secret";
    process.env.DATABASE_URL = "postgres://x";
    getSession.mockResolvedValue({ userId: 1, email: "a@b.com" });

    await expect(requireSession()).resolves.toBeUndefined();
    expect(redirect).not.toHaveBeenCalled();
  });
});
