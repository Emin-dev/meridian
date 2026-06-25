import { NextRequest, NextResponse } from "next/server";
import { and, eq, ilike, gte, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { getDb, schema } from "@/db";

const VALID_SOURCES = ["website", "referral", "linkedin", "cold-outreach", "other"] as const;
const VALID_STATUSES = ["lead", "active", "inactive", "churned"] as const;

function escapeCsv(value: string | null | undefined): string {
  if (value == null) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function GET(request: NextRequest) {
  const db = getDb();
  if (!db) {
    return new NextResponse("Database not connected", { status: 503 });
  }

  const sp = request.nextUrl.searchParams;
  const status = sp.get("status") ?? undefined;
  const company = sp.get("company") ?? undefined;
  const minScore = sp.get("minScore") ?? undefined;
  const source = sp.get("source") ?? undefined;
  const tag = sp.get("tag") ?? undefined;

  const statusFilter =
    status && (VALID_STATUSES as readonly string[]).includes(status)
      ? (status as (typeof VALID_STATUSES)[number])
      : undefined;
  const sourceFilter =
    source && (VALID_SOURCES as readonly string[]).includes(source)
      ? (source as (typeof VALID_SOURCES)[number])
      : undefined;
  const companyFilter = company?.trim() || undefined;
  const minScoreFilter =
    minScore && !isNaN(parseInt(minScore)) ? parseInt(minScore) : undefined;
  const tagFilter = tag?.trim() || undefined;

  const conditions: (SQL | undefined)[] = [
    statusFilter !== undefined ? eq(schema.contacts.status, statusFilter) : undefined,
    sourceFilter !== undefined ? eq(schema.contacts.source, sourceFilter) : undefined,
    companyFilter !== undefined
      ? ilike(schema.contacts.company, `%${companyFilter}%`)
      : undefined,
    minScoreFilter !== undefined
      ? gte(schema.contacts.leadScore, minScoreFilter)
      : undefined,
    tagFilter !== undefined
      ? sql`${schema.contacts.tags} @> ARRAY[${tagFilter}]::text[]`
      : undefined,
  ];

  const contacts = await db
    .select()
    .from(schema.contacts)
    .where(and(...conditions))
    .orderBy(schema.contacts.createdAt);

  const header = [
    "Name",
    "Email",
    "Phone",
    "Company",
    "Status",
    "Source",
    "Tags",
    "Lead Score",
    "Created Date",
  ].join(",");

  const rows = contacts.map((c) =>
    [
      escapeCsv(c.name),
      escapeCsv(c.email),
      escapeCsv(c.phone),
      escapeCsv(c.company),
      escapeCsv(c.status),
      escapeCsv(c.source),
      escapeCsv(c.tags.join("; ")),
      escapeCsv(c.leadScore?.toString()),
      escapeCsv(c.createdAt?.toISOString()),
    ].join(",")
  );

  const csv = [header, ...rows].join("\n");

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="contacts.csv"',
    },
  });
}
