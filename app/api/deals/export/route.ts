import { NextResponse } from "next/server";
import { getDb, schema } from "@/db";

function escapeCsv(value: string | null | undefined): string {
  if (value == null) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function GET() {
  const db = getDb();
  if (!db) {
    return new NextResponse("Database not connected", { status: 503 });
  }

  const deals = await db.query.deals.findMany({
    with: { contact: true },
    orderBy: (deals, { asc }) => [asc(deals.createdAt)],
  });

  const header = [
    "Title",
    "Stage",
    "Value",
    "Currency",
    "Probability",
    "Contact Name",
    "Expected Close Date",
    "Close Reason",
    "Created At",
  ].join(",");

  const rows = deals.map((d) =>
    [
      escapeCsv(d.title),
      escapeCsv(d.stage),
      escapeCsv(d.value),
      escapeCsv(d.currency),
      escapeCsv(d.probability?.toString()),
      escapeCsv(d.contact?.name),
      escapeCsv(d.expectedCloseDate?.toISOString()),
      escapeCsv(d.closeReason),
      escapeCsv(d.createdAt?.toISOString()),
    ].join(",")
  );

  const csv = [header, ...rows].join("\n");

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="deals.csv"',
    },
  });
}
