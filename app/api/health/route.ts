import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

// Always evaluated at request time so the DB status is live.
export const dynamic = "force-dynamic";

export async function GET() {
  const url = process.env.DATABASE_URL;

  // The app must stay healthy before the database is provisioned.
  if (!url) {
    return NextResponse.json({
      ok: true,
      service: "meridian",
      db: "not_configured",
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
      time: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        service: "meridian",
        db: "error",
        error: err instanceof Error ? err.message : String(err),
        time: new Date().toISOString(),
      },
      { status: 503 },
    );
  }
}
