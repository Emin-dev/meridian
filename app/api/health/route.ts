import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

// Always evaluated at request time so the DB status is live.
export const dynamic = "force-dynamic";

export async function GET() {
  const url = process.env.DATABASE_URL;
  // Short commit SHA of the running deployment (set by Vercel) — lets tooling
  // confirm a new deploy is actually live before smoke-testing it.
  const commit = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null;

  // The app must stay healthy before the database is provisioned.
  if (!url) {
    return NextResponse.json({
      ok: true,
      service: "meridian",
      db: "not_configured",
      commit,
      time: new Date().toISOString(),
    });
  }

  try {
    const sql = neon(url);
    const rows = (await sql`select now() as now`) as { now: string }[];
    return NextResponse.json({
      ok: true,
      service: "meridian",
      db: "connected",
      dbTime: rows[0]?.now ?? null,
      commit,
      time: new Date().toISOString(),
    });
  } catch (err) {
    // Log the real reason server-side only; never leak DB/driver internals to
    // the public health body.
    console.error("health check db query failed", err);
    return NextResponse.json(
      {
        ok: false,
        service: "meridian",
        db: "error",
        commit,
        time: new Date().toISOString(),
      },
      { status: 503 },
    );
  }
}
