"use server";

import { chat } from "@/lib/ai";

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

type DigestResult = { digest: string } | { error: string } | { noKey: true };

export async function generateDailyDigest(
  input: DigestInput
): Promise<DigestResult> {
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
    ]);

    return { digest };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("DEEPSEEK_API_KEY")) return { noKey: true };
    return { error: message };
  }
}
