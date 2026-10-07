import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { SignJWT } from "jose";
import { config, proxy } from "@/proxy";

const secret = "synthetic-test-secret-not-a-real-credential";
const request = (path = "/dashboard", token?: string) => new NextRequest(
  `https://meridian.example${path}`,
  token ? { headers: { cookie: `session=${token}` } } : undefined
);

beforeEach(() => {
  vi.stubEnv("DATABASE_URL", "postgres://synthetic.invalid/test");
  vi.stubEnv("AUTH_SECRET", secret);
  vi.stubEnv("AUTH_ENABLED", undefined);
});
afterEach(() => vi.unstubAllEnvs());

describe("proxy authorization", () => {
  it("blocks a missing signing secret with a non-cacheable 503", async () => {
    vi.stubEnv("AUTH_SECRET", undefined);
    const response = await proxy(request());
    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ error: "Service configuration unavailable." });
  });

  it("blocks a DB-connected demo opt-out", async () => {
    vi.stubEnv("AUTH_ENABLED", "false");
    expect((await proxy(request())).status).toBe(503);
  });

  it("allows an explicit no-DB demo without a session", async () => {
    vi.stubEnv("DATABASE_URL", undefined);
    vi.stubEnv("AUTH_SECRET", undefined);
    vi.stubEnv("AUTH_ENABLED", "false");
    expect((await proxy(request())).headers.get("x-middleware-next")).toBe("1");
  });

  it("redirects an anonymous request to login", async () => {
    const response = await proxy(request());
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://meridian.example/login");
  });

  it("clears invalid sessions", async () => {
    const response = await proxy(request("/contacts", "invalid-token"));
    expect(response.status).toBe(307);
    expect(response.cookies.get("session")?.value).toBe("");
  });

  it("allows a valid HS256 session", async () => {
    const token = await new SignJWT({ userId: 1, email: "test@example.invalid" })
      .setProtectedHeader({ alg: "HS256" }).setExpirationTime("1h")
      .sign(new TextEncoder().encode(secret));
    expect((await proxy(request("/contacts", token))).headers.get("x-middleware-next")).toBe("1");
  });

  it("rejects expired sessions", async () => {
    const token = await new SignJWT({ userId: 1, email: "test@example.invalid" })
      .setProtectedHeader({ alg: "HS256" }).setExpirationTime(1)
      .sign(new TextEncoder().encode(secret));
    expect((await proxy(request("/contacts", token))).status).toBe(307);
  });
});

describe("proxy route boundaries", () => {
  it.each(["/dashboard", "/contacts", "/api/contacts/export", "/api/deals/export", "/login-extra", "/api/health-extra", "/faviconXico"])("protects %s", (url) => {
    expect(unstable_doesMiddlewareMatch({ config, url })).toBe(true);
  });
  it.each(["/login", "/api/health", "/_next/static/chunk.js", "/_next/image", "/favicon.ico"])("exempts %s", (url) => {
    expect(unstable_doesMiddlewareMatch({ config, url })).toBe(false);
  });
});
