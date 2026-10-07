import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { getDb, getSession } = vi.hoisted(() => ({ getDb: vi.fn(), getSession: vi.fn() }));
vi.mock("@/db", () => ({ getDb, schema: {} }));
vi.mock("@/lib/auth", () => ({ getSession }));
vi.mock("next/navigation", () => ({ redirect: () => { throw new Error("NEXT_REDIRECT"); } }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { addTask } from "@/app/(app)/tasks/actions";
import { GET as exportContacts } from "@/app/api/contacts/export/route";
import { GET as exportDeals } from "@/app/api/deals/export/route";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("DATABASE_URL", "postgres://synthetic.invalid/test");
  vi.stubEnv("AUTH_SECRET", "synthetic-secret");
  vi.stubEnv("AUTH_ENABLED", undefined);
  getSession.mockResolvedValue(null);
  getDb.mockReturnValue(null);
});
afterEach(() => vi.unstubAllEnvs());

function taskData() {
  const data = new FormData();
  data.set("subject", "Synthetic task");
  data.set("dueAt", "2030-01-01");
  return data;
}

describe("direct Server Action protection", () => {
  it("blocks an anonymous write before obtaining a database client", async () => {
    await expect(addTask({}, taskData())).rejects.toThrow("NEXT_REDIRECT");
    expect(getDb).not.toHaveBeenCalled();
  });

  it("blocks a missing secret before obtaining a database client", async () => {
    vi.stubEnv("AUTH_SECRET", undefined);
    await expect(addTask({}, taskData())).rejects.toThrow("AUTH_SECRET is required");
    expect(getDb).not.toHaveBeenCalled();
    expect(getSession).not.toHaveBeenCalled();
  });

  it("keeps explicit no-DB demo actions non-persistent", async () => {
    vi.stubEnv("DATABASE_URL", undefined);
    vi.stubEnv("AUTH_SECRET", undefined);
    vi.stubEnv("AUTH_ENABLED", "false");
    await expect(addTask({}, taskData())).resolves.toEqual({ noDb: true });
    expect(getSession).not.toHaveBeenCalled();
  });
});

describe.each([
  ["contacts", exportContacts],
  ["deals", exportDeals],
] as const)("%s export protection", (name, handler) => {
  const request = () => new NextRequest(`https://meridian.example/api/${name}/export`);

  it("blocks anonymous direct requests before data access", async () => {
    expect((await handler(request())).status).toBe(401);
    expect(getDb).not.toHaveBeenCalled();
  });

  it("fails closed when the secret is missing", async () => {
    vi.stubEnv("AUTH_SECRET", undefined);
    await expect(handler(request())).rejects.toThrow("AUTH_SECRET is required");
    expect(getDb).not.toHaveBeenCalled();
  });

  it("does not export records in no-DB demo mode", async () => {
    vi.stubEnv("DATABASE_URL", undefined);
    vi.stubEnv("AUTH_SECRET", undefined);
    vi.stubEnv("AUTH_ENABLED", "false");
    expect((await handler(request())).status).toBe(503);
    expect(getSession).not.toHaveBeenCalled();
  });
});
