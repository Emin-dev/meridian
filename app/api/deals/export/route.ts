import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { escapeCsv } from "@/lib/csv";
import { isAuthEnabled } from "@/lib/auth-config";
import { getSession } from "@/lib/auth";

// Hard cap so a workspace with tens of thousands of deals can't make this GET
// route materialize the whole table (and CSV string) in memory and blow the
// Vercel 10s budget. Rows are streamed out in chunks rather than concatenated
// into one giant string. Mirrors the contacts export.
const EXPORT_MAX_ROWS = 10000;
const CSV_CHUNK_ROWS = 500;

export async function GET(request: Request) {
  // Defense-in-depth: this route exports the full deals pipeline (values, owners,
  // contact names). Middleware already gates it when auth is enabled, but a bulk
  // export must not rely on a single layer — re-check the session here too.
  if (isAuthEnabled() && !(await getSession())) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const db = getDb();
  if (!db) {
    return new NextResponse("Database not connected", { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const owner = searchParams.get("owner")?.trim() || "";
  const stageParam = searchParams.get("stage")?.trim() || "";
  const stage = schema.dealStageEnum.enumValues.find((s) => s === stageParam) ?? null;

  const conditions = [];
  if (owner) conditions.push(eq(schema.deals.owner, owner));
  if (stage) conditions.push(eq(schema.deals.stage, stage));

  // Narrow the deal columns to those the CSV emits, narrow the joined contact to
  // just its name (only field used), and hard-cap the row count so the request
  // stays within the Vercel 10s/memory budget on huge workspaces. The deals list
  // page does exactly this contact narrowing for its own query.
  let deals;
  try {
    deals = await db.query.deals.findMany({
      columns: {
        title: true,
        stage: true,
        value: true,
        currency: true,
        probability: true,
        owner: true,
        expectedCloseDate: true,
        closeReason: true,
        createdAt: true,
      },
      with: { contact: { columns: { name: true } } },
      where: conditions.length ? and(...conditions) : undefined,
      orderBy: (deals, { asc }) => [asc(deals.createdAt)],
      limit: EXPORT_MAX_ROWS,
    });
  } catch (err) {
    console.error("deals export query failed", err);
    return new NextResponse("Could not export right now. Please try again.", { status: 503 });
  }

  const header = [
    "Title",
    "Stage",
    "Value",
    "Currency",
    "Probability",
    "Owner",
    "Contact Name",
    "Expected Close Date",
    "Close Reason",
    "Created At",
  ].join(",");

  // Stream the CSV in chunks of rows so we never hold one giant string in
  // memory. The bounded result above keeps the total work small either way.
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(header));
      for (let i = 0; i < deals.length; i += CSV_CHUNK_ROWS) {
        const chunk = deals
          .slice(i, i + CSV_CHUNK_ROWS)
          .map((d) =>
            "\n" +
            [
              escapeCsv(d.title),
              escapeCsv(d.stage),
              escapeCsv(d.value),
              escapeCsv(d.currency),
              escapeCsv(d.probability?.toString()),
              escapeCsv(d.owner),
              escapeCsv(d.contact?.name),
              escapeCsv(d.expectedCloseDate?.toISOString()),
              escapeCsv(d.closeReason),
              escapeCsv(d.createdAt?.toISOString()),
            ].join(","),
          )
          .join("");
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });

  return new NextResponse(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="deals.csv"',
    },
  });
}
