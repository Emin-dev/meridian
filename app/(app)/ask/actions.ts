"use server";

import { desc, gte } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { chat } from "@/lib/ai";

export type AskResult = {
  answer: string;
  contacts: Array<{ id: number; name: string }>;
  deals: Array<{ id: number; title: string }>;
};

type AiResponse = {
  answer: string;
  contactIds: number[];
  dealIds: number[];
};

export async function askCrm(question: string): Promise<AskResult> {
  const q = question.trim();
  if (!q) return { answer: "", contacts: [], deals: [] };

  const db = getDb();
  if (!db) {
    return {
      answer: "Database not connected. Set DATABASE_URL to enable AI search.",
      contacts: [],
      deals: [],
    };
  }

  if (!process.env.DEEPSEEK_API_KEY) {
    return {
      answer: "AI not configured. Set DEEPSEEK_API_KEY to enable Ask your CRM.",
      contacts: [],
      deals: [],
    };
  }

  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  const [contacts, deals, recentActivities] = await Promise.all([
    db
      .select({
        id: schema.contacts.id,
        name: schema.contacts.name,
        company: schema.contacts.company,
        status: schema.contacts.status,
        updatedAt: schema.contacts.updatedAt,
      })
      .from(schema.contacts)
      .orderBy(desc(schema.contacts.updatedAt))
      .limit(150),
    db
      .select({
        id: schema.deals.id,
        title: schema.deals.title,
        stage: schema.deals.stage,
        value: schema.deals.value,
        expectedCloseDate: schema.deals.expectedCloseDate,
        contactId: schema.deals.contactId,
        updatedAt: schema.deals.updatedAt,
      })
      .from(schema.deals)
      .orderBy(desc(schema.deals.updatedAt))
      .limit(150),
    db
      .select({
        contactId: schema.activities.contactId,
        dealId: schema.activities.dealId,
        type: schema.activities.type,
        completedAt: schema.activities.completedAt,
        createdAt: schema.activities.createdAt,
      })
      .from(schema.activities)
      .where(gte(schema.activities.createdAt, ninetyDaysAgo))
      .orderBy(desc(schema.activities.createdAt))
      .limit(300),
  ]);

  const today = new Date().toISOString().split("T")[0];

  const contactLines = contacts.map(
    (c) =>
      `id=${c.id} | ${c.name}${c.company ? ` | ${c.company}` : ""} | status=${c.status ?? "unknown"} | updated=${c.updatedAt.toISOString().split("T")[0]}`
  );

  const dealLines = deals.map(
    (d) =>
      `id=${d.id} | ${d.title} | stage=${d.stage} | value=${d.value ? `$${Number(d.value).toLocaleString()}` : "none"} | close=${d.expectedCloseDate ? d.expectedCloseDate.toISOString().split("T")[0] : "none"} | contactId=${d.contactId ?? "none"} | updated=${d.updatedAt.toISOString().split("T")[0]}`
  );

  const activityLines = recentActivities.map(
    (a) =>
      `contactId=${a.contactId ?? "none"} | dealId=${a.dealId ?? "none"} | type=${a.type} | completed=${a.completedAt ? a.completedAt.toISOString().split("T")[0] : "no"} | date=${a.createdAt.toISOString().split("T")[0]}`
  );

  const context = [
    `Today: ${today}`,
    "",
    `CONTACTS (${contacts.length}):`,
    ...contactLines,
    "",
    `DEALS (${deals.length}):`,
    ...dealLines,
    "",
    `RECENT ACTIVITIES (${recentActivities.length}, last 90 days):`,
    ...activityLines,
  ].join("\n");

  const systemPrompt = `You are an AI assistant for a CRM system. Use the CRM data below to answer the user's question.
Return a JSON object with exactly these fields:
- "answer": a short plain-language answer (2-5 sentences, no markdown, no lists)
- "contactIds": array of integer contact IDs relevant to the answer (empty array if none)
- "dealIds": array of integer deal IDs relevant to the answer (empty array if none)

Only include IDs that are genuinely relevant to the answer.

CRM DATA:
${context}`;

  let aiResponse: AiResponse;
  try {
    const raw = await chat(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: q },
      ],
      { json: true }
    );
    aiResponse = JSON.parse(raw) as AiResponse;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "AI request failed.";
    return { answer: `Error: ${msg}`, contacts: [], deals: [] };
  }

  const contactMap = new Map(contacts.map((c) => [c.id, c.name]));
  const dealMap = new Map(deals.map((d) => [d.id, d.title]));

  const matchedContacts = (aiResponse.contactIds ?? [])
    .filter((id) => contactMap.has(id))
    .map((id) => ({ id, name: contactMap.get(id)! }));

  const matchedDeals = (aiResponse.dealIds ?? [])
    .filter((id) => dealMap.has(id))
    .map((id) => ({ id, title: dealMap.get(id)! }));

  return {
    answer: aiResponse.answer ?? "",
    contacts: matchedContacts,
    deals: matchedDeals,
  };
}
