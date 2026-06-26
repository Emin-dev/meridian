import { NextRequest, NextResponse } from "next/server";
import { and, eq, ilike, gte, isNull, notExists, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { isAuthEnabled } from "@/lib/auth-config";
import { getSession } from "@/lib/auth";

const VALID_SOURCES = ["website", "referral", "linkedin", "cold-outreach", "other"] as const;
const VALID_STATUSES = ["lead", "active", "inactive", "churned"] as const;

// Hard cap so a workspace with tens of thousands of contacts can't make this
// GET route materialize the whole table (and CSV string) in memory and blow the
// Vercel 10s budget. Rows are streamed out in chunks rather than concatenated
// into one giant string. Mirrors the contacts page's deliberate pagination.
const EXPORT_MAX_ROWS = 10000;
const CSV_CHUNK_ROWS = 500;

function escapeCsv(value: string | null | undefined): string {
  if (value == null) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function GET(request: NextRequest) {
  // Defense-in-depth: this route streams the entire contact database as CSV with
  // full PII. The middleware already gates it when auth is enabled, but never
  // rely on a single layer for a bulk-export endpoint — re-check the session here.
  if (isAuthEnabled() && !(await getSession())) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

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
  const unscored = sp.get("unscored") ?? undefined;
  const noActivity = sp.get("noActivity") ?? undefined;

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
  const unscoredFilter = unscored === "1";
  const noActivityDays =
    noActivity && !isNaN(parseInt(noActivity)) ? parseInt(noActivity) : undefined;

  // "No activity in N days" → keep contacts that have NO activity dated on or
  // after the cutoff. Done as a correlated NOT EXISTS so the DB filters rows
  // instead of transferring every activity into JS (mirrors the contacts page).
  const noActivityCutoff =
    noActivityDays !== undefined
      ? new Date(Date.now() - noActivityDays * 24 * 60 * 60 * 1000)
      : undefined;

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
    unscoredFilter ? isNull(schema.contacts.leadScore) : undefined,
    noActivityCutoff !== undefined
      ? notExists(
          db
            .select({ one: sql`1` })
            .from(schema.activities)
            .where(
              and(
                eq(schema.activities.contactId, schema.contacts.id),
                gte(schema.activities.createdAt, noActivityCutoff),
              ),
            ),
        )
      : undefined,
  ];

  // Select only the columns the CSV emits, and hard-cap the row count so the
  // request stays within the Vercel 10s/memory budget on huge workspaces.
  const contacts = await db
    .select({
      name: schema.contacts.name,
      email: schema.contacts.email,
      phone: schema.contacts.phone,
      company: schema.contacts.company,
      status: schema.contacts.status,
      source: schema.contacts.source,
      tags: schema.contacts.tags,
      leadScore: schema.contacts.leadScore,
      createdAt: schema.contacts.createdAt,
    })
    .from(schema.contacts)
    .where(and(...conditions))
    .orderBy(schema.contacts.createdAt)
    .limit(EXPORT_MAX_ROWS);

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

  // Stream the CSV in chunks of rows so we never hold one giant string in
  // memory. The bounded result above keeps the total work small either way.
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(header));
      for (let i = 0; i < contacts.length; i += CSV_CHUNK_ROWS) {
        const chunk = contacts
          .slice(i, i + CSV_CHUNK_ROWS)
          .map((c) =>
            "\n" +
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
      "Content-Disposition": 'attachment; filename="contacts.csv"',
    },
  });
}
