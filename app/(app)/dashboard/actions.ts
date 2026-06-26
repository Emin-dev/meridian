"use server";

import { z } from "zod";
import { chat } from "@/lib/ai";
import { eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb, schema } from "@/db";

const idSchema = z.coerce.number().int().positive();

const DIGEST_CACHE_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours
const WEEKLY_DIGEST_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

type StageData = { stage: string; count: number; value: number };

type DigestInput = {
  totalContacts: number;
  openDealsCount: number;
  pipelineValue: number;
  recentActivities: {
    subject: string;
    type: string;
    contactName?: string | null;
    dealTitle?: string | null;
  }[];
  dealsByStage: StageData[];
  overdueCount: number;
  topContacts: { name: string; leadScore: number }[];
};

type DigestResult =
  | { digest: string; cachedAt: string }
  | { error: string }
  | { noKey: true };

export async function completeAgendaItem(id: number): Promise<void> {
  if (!idSchema.safeParse(id).success) throw new Error("Invalid agenda item id.");
  const db = getDb();
  // No DB: surface the failure instead of resolving silently, which would make
  // the form action look like the item was completed when nothing was written.
  if (!db) throw new Error("Database not connected — can't complete this item.");
  const now = new Date();
  await db
    .update(schema.activities)
    .set({ completedAt: now, updatedAt: now })
    .where(eq(schema.activities.id, id));
  revalidatePath("/dashboard");
}

export async function generateDailyDigest(
  input: DigestInput,
  force = false
): Promise<DigestResult> {
  const db = getDb();

  // Serve from cache if fresh and not forced
  if (!force && db) {
    try {
      const rows = await db
        .select()
        .from(schema.appSettings)
        .where(inArray(schema.appSettings.key, ["digestCache", "digestCachedAt"]));
      const cacheMap: Record<string, string> = {};
      for (const row of rows) cacheMap[row.key] = row.value;
      if (cacheMap.digestCache && cacheMap.digestCachedAt) {
        const age = Date.now() - new Date(cacheMap.digestCachedAt).getTime();
        if (age < DIGEST_CACHE_TTL_MS) {
          return { digest: cacheMap.digestCache, cachedAt: cacheMap.digestCachedAt };
        }
      }
    } catch {
      // Fall through to regenerate
    }
  }

  try {
    const stagesSummary = input.dealsByStage
      .filter((s) => s.count > 0)
      .map(
        (s) =>
          `${s.stage}: ${s.count} deal(s)${
            s.value > 0 ? ` worth $${s.value.toLocaleString()}` : ""
          }`
      )
      .join(", ");

    const activitiesSummary = input.recentActivities
      .slice(0, 5)
      .map(
        (a) =>
          `${a.type} – "${a.subject}"${
            a.contactName ? ` (${a.contactName})` : ""
          }`
      )
      .join("\n");

    const topContactsSummary =
      input.topContacts.length > 0
        ? input.topContacts
            .map((c) => `${c.name} (score: ${c.leadScore})`)
            .join(", ")
        : "None scored yet";

    const digest = await chat([
      {
        role: "system",
        content:
          "You are a concise sales coach assistant. Respond with exactly 3–5 short bullet points (each starting with •). Be direct and actionable. Reference specific contacts or stages when relevant.",
      },
      {
        role: "user",
        content: `Today's CRM snapshot:
- Total contacts: ${input.totalContacts}
- Open deals: ${input.openDealsCount} (pipeline: $${input.pipelineValue.toLocaleString()})
- Pipeline by stage: ${stagesSummary || "No deals yet"}
- Overdue activities: ${input.overdueCount}
- Top contacts by lead score: ${topContactsSummary}
- Recent activity:
${activitiesSummary || "No recent activity"}

What are my top priorities today to move deals forward and avoid anything slipping?`,
      },
    ], { maxTokens: 512 });

    const cachedAt = new Date().toISOString();

    // Persist to cache
    if (db) {
      try {
        const now = new Date();
        await db
          .insert(schema.appSettings)
          .values({ key: "digestCache", value: digest })
          .onConflictDoUpdate({
            target: schema.appSettings.key,
            set: { value: digest, updatedAt: now },
          });
        await db
          .insert(schema.appSettings)
          .values({ key: "digestCachedAt", value: cachedAt })
          .onConflictDoUpdate({
            target: schema.appSettings.key,
            set: { value: cachedAt, updatedAt: now },
          });
      } catch {
        // Non-fatal: digest still returned even if caching fails
      }
    }

    return { digest, cachedAt };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("DEEPSEEK_API_KEY")) return { noKey: true };
    const friendly = message.includes("timed out")
      ? message
      : "Couldn't generate the digest right now. Please try again.";
    return { error: friendly };
  }
}

export type WeeklyDigestInput = {
  wins: { title: string; value: number }[];
  atRisk: { title: string; stage: string; reason: string; value: number }[];
  openDealsCount: number;
  pipelineValue: number;
  dealsByStage: StageData[];
  activitiesThisWeek: number;
  overdueCount: number;
  topContacts: { name: string; leadScore: number }[];
};

export async function generateWeeklyDigest(
  input: WeeklyDigestInput,
  force = false
): Promise<DigestResult> {
  const db = getDb();

  // Serve from cache if fresh and not forced
  if (!force && db) {
    try {
      const rows = await db
        .select()
        .from(schema.appSettings)
        .where(
          inArray(schema.appSettings.key, [
            "weeklyDigestCache",
            "weeklyDigestCachedAt",
          ])
        );
      const cacheMap: Record<string, string> = {};
      for (const row of rows) cacheMap[row.key] = row.value;
      if (cacheMap.weeklyDigestCache && cacheMap.weeklyDigestCachedAt) {
        const age =
          Date.now() - new Date(cacheMap.weeklyDigestCachedAt).getTime();
        if (age < WEEKLY_DIGEST_CACHE_TTL_MS) {
          return {
            digest: cacheMap.weeklyDigestCache,
            cachedAt: cacheMap.weeklyDigestCachedAt,
          };
        }
      }
    } catch {
      // Fall through to regenerate
    }
  }

  try {
    const winsSummary =
      input.wins.length > 0
        ? input.wins
            .map(
              (w) =>
                `${w.title}${
                  w.value > 0 ? ` ($${w.value.toLocaleString()})` : ""
                }`
            )
            .join(", ")
        : "No deals closed-won this week";

    const atRiskSummary =
      input.atRisk.length > 0
        ? input.atRisk
            .map(
              (d) =>
                `${d.title} [${d.stage}${
                  d.value > 0 ? `, $${d.value.toLocaleString()}` : ""
                }] – ${d.reason}`
            )
            .join("\n")
        : "No deals flagged at-risk";

    const stagesSummary = input.dealsByStage
      .filter((s) => s.count > 0)
      .map(
        (s) =>
          `${s.stage}: ${s.count} deal(s)${
            s.value > 0 ? ` worth $${s.value.toLocaleString()}` : ""
          }`
      )
      .join(", ");

    const topContactsSummary =
      input.topContacts.length > 0
        ? input.topContacts
            .map((c) => `${c.name} (score: ${c.leadScore})`)
            .join(", ")
        : "None scored yet";

    const digest = await chat([
      {
        role: "system",
        content:
          "You are a concise sales chief-of-staff. Write a brief weekly review with three labelled sections, each on its own line and prefixed exactly: 'Wins:', 'At risk:', 'Priorities:'. After each label give one tight sentence (no bullets, no markdown). Be specific — name deals, stages, or contacts. If a section has nothing notable, say so plainly.",
      },
      {
        role: "user",
        content: `This week's CRM snapshot:
- Closed-won this week: ${winsSummary}
- At-risk open deals:
${atRiskSummary}
- Open deals: ${input.openDealsCount} (pipeline: $${input.pipelineValue.toLocaleString()})
- Pipeline by stage: ${stagesSummary || "No deals yet"}
- Activities logged this week: ${input.activitiesThisWeek}
- Overdue activities: ${input.overdueCount}
- Top contacts by lead score: ${topContactsSummary}

Summarize the week: what went well (Wins), what's slipping (At risk), and the top priorities for next week (Priorities).`,
      },
    ], { maxTokens: 384 });

    const cachedAt = new Date().toISOString();

    // Persist to cache
    if (db) {
      try {
        const now = new Date();
        await db
          .insert(schema.appSettings)
          .values({ key: "weeklyDigestCache", value: digest })
          .onConflictDoUpdate({
            target: schema.appSettings.key,
            set: { value: digest, updatedAt: now },
          });
        await db
          .insert(schema.appSettings)
          .values({ key: "weeklyDigestCachedAt", value: cachedAt })
          .onConflictDoUpdate({
            target: schema.appSettings.key,
            set: { value: cachedAt, updatedAt: now },
          });
      } catch {
        // Non-fatal: digest still returned even if caching fails
      }
    }

    return { digest, cachedAt };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("DEEPSEEK_API_KEY")) return { noKey: true };
    const friendly = message.includes("timed out")
      ? message
      : "Couldn't generate the digest right now. Please try again.";
    return { error: friendly };
  }
}
