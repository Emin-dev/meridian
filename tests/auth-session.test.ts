import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SignJWT } from "jose";

const { cookieGet } = vi.hoisted(() => ({ cookieGet: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: cookieGet }) }));
import { getSession } from "@/lib/auth";

const secret = "synthetic-session-test-key-not-for-deployment";
const user = { userId: 1, email: "test@example.invalid" };

beforeEach(() => {
  cookieGet.mockReset();
  vi.stubEnv("AUTH_SECRET", secret);
});
afterEach(() => vi.unstubAllEnvs());

async function signedToken(algorithm: string, expiration: string | number = "1h") {
  return new SignJWT(user).setProtectedHeader({ alg: algorithm })
    .setExpirationTime(expiration).sign(new TextEncoder().encode(secret));
}

describe("server-side session verification", () => {
  it("accepts a valid HS256 session", async () => {
    cookieGet.mockReturnValue({ value: await signedToken("HS256") });
    expect(await getSession()).toMatchObject(user);
  });

  it("rejects a token signed with another algorithm", async () => {
    cookieGet.mockReturnValue({ value: await signedToken("HS384") });
    expect(await getSession()).toBeNull();
  });

  it("rejects expired sessions", async () => {
    cookieGet.mockReturnValue({ value: await signedToken("HS256", 1) });
    expect(await getSession()).toBeNull();
  });

  it("does not authenticate when the signing secret is absent", async () => {
    cookieGet.mockReturnValue({ value: await signedToken("HS256") });
    vi.stubEnv("AUTH_SECRET", undefined);
    expect(await getSession()).toBeNull();
  });
});
