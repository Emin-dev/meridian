import type { getDb } from "./index";
import { contacts, deals, activities } from "./schema";

type Db = NonNullable<ReturnType<typeof getDb>>;

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

export async function insertDemoData(db: Db): Promise<void> {
  const insertedContacts = await db
    .insert(contacts)
    .values([
      {
        name: "Sarah Chen",
        email: "sarah.chen@techvault.io",
        phone: "+1 415-555-0101",
        company: "TechVault Inc",
        title: "VP of Sales",
        notes:
          "Key decision maker. Interested in enterprise integrations and SSO.",
        status: "active" as const,
        leadScore: 85,
        leadScoreRationale:
          "Senior role with clear budget authority at a fast-growing SaaS company.",
        leadScoredAt: daysAgo(3),
        createdAt: daysAgo(60),
        updatedAt: daysAgo(3),
      },
      {
        name: "Marcus Rodriguez",
        email: "m.rodriguez@quantumdyn.com",
        phone: "+1 312-555-0202",
        company: "Quantum Dynamics",
        title: "CTO",
        notes:
          "Technical buyer. Needs strong API access and data export options.",
        status: "active" as const,
        leadScore: 72,
        leadScoreRationale:
          "Strong technical influence; budget approval requires CFO sign-off.",
        leadScoredAt: daysAgo(8),
        createdAt: daysAgo(45),
        updatedAt: daysAgo(5),
      },
      {
        name: "Emily Harrison",
        email: "emily@bluewavecorp.com",
        phone: "+1 212-555-0303",
        company: "BlueWave Corp",
        title: "Marketing Director",
        notes:
          "Existing customer on Starter plan. Ready to expand to the sales team.",
        status: "active" as const,
        leadScore: 60,
        leadScoreRationale:
          "Already a customer — expansion opportunity with proven ROI.",
        leadScoredAt: daysAgo(30),
        createdAt: daysAgo(90),
        updatedAt: daysAgo(7),
      },
      {
        name: "David Kim",
        email: "david.kim@nexgen.io",
        phone: "+1 650-555-0404",
        company: "NexGen Solutions",
        title: "CEO",
        notes:
          "Evaluating three CRM vendors. Final decision due next quarter.",
        status: "lead" as const,
        leadScore: 91,
        leadScoreRationale:
          "C-level sponsor with full budget authority; company just closed Series B.",
        leadScoredAt: daysAgo(1),
        createdAt: daysAgo(30),
        updatedAt: daysAgo(1),
      },
      {
        name: "Lisa Thompson",
        email: "l.thompson@pivotsoft.dev",
        phone: null,
        company: "PivotSoft",
        title: "Head of Engineering",
        notes:
          "Early-stage interest. Budget approval is still pending from finance.",
        status: "lead" as const,
        leadScore: 45,
        leadScoreRationale:
          "Technical fit is strong but no clear budget authority confirmed.",
        leadScoredAt: daysAgo(14),
        createdAt: daysAgo(20),
        updatedAt: daysAgo(10),
      },
      {
        name: "James O'Brien",
        email: "jobrien@cloudfirst.com",
        phone: "+1 617-555-0606",
        company: "CloudFirst Systems",
        title: "Product Manager",
        notes:
          "Deal closed lost — went with a cheaper on-premise competitor. Re-engage in Q3.",
        status: "churned" as const,
        leadScore: 68,
        leadScoreRationale:
          "Good product fit; lost on price. Worth revisiting after competitor contract expires.",
        leadScoredAt: daysAgo(20),
        createdAt: daysAgo(75),
        updatedAt: daysAgo(15),
      },
      {
        name: "Rachel Patel",
        email: "rachel@innovateco.ai",
        phone: "+1 408-555-0707",
        company: "InnovateCo",
        title: "Founder & CEO",
        notes:
          "Trial user for 3 weeks; very positive feedback. Ready to close.",
        status: "active" as const,
        leadScore: 78,
        leadScoreRationale:
          "Founder with full decision authority; high engagement in trial.",
        leadScoredAt: daysAgo(5),
        createdAt: daysAgo(25),
        updatedAt: daysAgo(2),
      },
      {
        name: "Tom Walker",
        email: "tom.walker@summitanalytics.co",
        phone: "+1 303-555-0808",
        company: "Summit Analytics",
        title: "VP of Operations",
        notes:
          "Looking to consolidate three tools into one platform. IT director needs to approve.",
        status: "inactive" as const,
        leadScore: 55,
        leadScoreRationale:
          "Budget exists but requires IT stakeholder alignment before purchase.",
        leadScoredAt: daysAgo(10),
        createdAt: daysAgo(35),
        updatedAt: daysAgo(6),
      },
    ])
    .returning({ id: contacts.id, name: contacts.name });

  const byName: Record<string, number> = {};
  for (const c of insertedContacts) {
    byName[c.name] = c.id;
  }

  const insertedDeals = await db
    .insert(deals)
    .values([
      {
        title: "TechVault Enterprise License",
        stage: "negotiation" as const,
        value: "45000",
        currency: "USD",
        contactId: byName["Sarah Chen"],
        expectedCloseDate: daysAgo(-14),
        notes: "Final pricing discussion underway. Legal reviewing MSA.",
        createdAt: daysAgo(50),
        updatedAt: daysAgo(2),
      },
      {
        title: "Quantum Dynamics Platform Upgrade",
        stage: "proposal" as const,
        value: "120000",
        currency: "USD",
        contactId: byName["Marcus Rodriguez"],
        expectedCloseDate: daysAgo(-30),
        notes: "12-month proposal submitted. Awaiting technical review sign-off.",
        createdAt: daysAgo(35),
        updatedAt: daysAgo(5),
      },
      {
        title: "NexGen CRM Migration",
        stage: "qualified" as const,
        value: "85000",
        currency: "USD",
        contactId: byName["David Kim"],
        expectedCloseDate: daysAgo(-45),
        notes: "Qualified through initial discovery. Strong two-way interest.",
        createdAt: daysAgo(25),
        updatedAt: daysAgo(1),
      },
      {
        title: "BlueWave Marketing Suite Expansion",
        stage: "won" as const,
        value: "32000",
        currency: "USD",
        contactId: byName["Emily Harrison"],
        expectedCloseDate: daysAgo(7),
        notes: "Contract signed. Onboarding call scheduled for next Tuesday.",
        createdAt: daysAgo(90),
        updatedAt: daysAgo(7),
      },
      {
        title: "PivotSoft Starter Package",
        stage: "lead" as const,
        value: "12000",
        currency: "USD",
        contactId: byName["Lisa Thompson"],
        expectedCloseDate: daysAgo(-60),
        notes: "Initial contact made via inbound form. Needs follow-up call.",
        createdAt: daysAgo(15),
        updatedAt: daysAgo(10),
      },
      {
        title: "CloudFirst Integration Project",
        stage: "lost" as const,
        value: "28000",
        currency: "USD",
        contactId: byName["James O'Brien"],
        expectedCloseDate: daysAgo(20),
        notes: "Lost to on-premise competitor on price. Re-engage Q3.",
        createdAt: daysAgo(75),
        updatedAt: daysAgo(15),
      },
      {
        title: "InnovateCo Growth Plan",
        stage: "negotiation" as const,
        value: "65000",
        currency: "USD",
        contactId: byName["Rachel Patel"],
        expectedCloseDate: daysAgo(-10),
        notes: "Final contract under review. High priority — close this week.",
        createdAt: daysAgo(20),
        updatedAt: daysAgo(1),
      },
      {
        title: "Summit Analytics Expansion",
        stage: "proposal" as const,
        value: "95000",
        currency: "USD",
        contactId: byName["Tom Walker"],
        expectedCloseDate: daysAgo(-21),
        notes: "3-year proposal submitted. IT stakeholder review pending.",
        createdAt: daysAgo(30),
        updatedAt: daysAgo(4),
      },
    ])
    .returning({ id: deals.id, title: deals.title });

  const dealByTitle: Record<string, number> = {};
  for (const d of insertedDeals) {
    dealByTitle[d.title] = d.id;
  }

  await db.insert(activities).values([
    {
      type: "call" as const,
      subject: "Discovery call — TechVault requirements",
      body: "Discussed enterprise SSO and audit-log requirements. Sarah is the sole decision maker. Action: send pricing proposal this week.",
      contactId: byName["Sarah Chen"],
      dealId: dealByTitle["TechVault Enterprise License"],
      completedAt: daysAgo(50),
      createdAt: daysAgo(50),
      updatedAt: daysAgo(50),
    },
    {
      type: "email" as const,
      subject: "Pricing proposal sent to TechVault",
      body: "Sent updated Enterprise deck with volume discounts and 90-day implementation plan.",
      contactId: byName["Sarah Chen"],
      dealId: dealByTitle["TechVault Enterprise License"],
      completedAt: daysAgo(35),
      createdAt: daysAgo(35),
      updatedAt: daysAgo(35),
    },
    {
      type: "meeting" as const,
      subject: "TechVault contract review",
      body: "Walked through MSA terms. Sarah requested two minor edits — redlined and returned.",
      contactId: byName["Sarah Chen"],
      dealId: dealByTitle["TechVault Enterprise License"],
      completedAt: daysAgo(5),
      createdAt: daysAgo(5),
      updatedAt: daysAgo(5),
    },
    {
      type: "call" as const,
      subject: "Technical deep-dive with Marcus",
      body: "Demoed REST API and webhook support. Marcus impressed by event-driven architecture. Requested SOC 2 report.",
      contactId: byName["Marcus Rodriguez"],
      dealId: dealByTitle["Quantum Dynamics Platform Upgrade"],
      completedAt: daysAgo(30),
      createdAt: daysAgo(30),
      updatedAt: daysAgo(30),
    },
    {
      type: "email" as const,
      subject: "Quantum Dynamics proposal delivered",
      body: "Sent 12-month enterprise proposal including implementation timeline and dedicated CSM.",
      contactId: byName["Marcus Rodriguez"],
      dealId: dealByTitle["Quantum Dynamics Platform Upgrade"],
      completedAt: daysAgo(10),
      createdAt: daysAgo(10),
      updatedAt: daysAgo(10),
    },
    {
      type: "meeting" as const,
      subject: "Initial discovery — NexGen Solutions",
      body: "Very positive first call. David is evaluating three vendors. Asked for a custom ROI model.",
      contactId: byName["David Kim"],
      dealId: dealByTitle["NexGen CRM Migration"],
      completedAt: daysAgo(20),
      createdAt: daysAgo(20),
      updatedAt: daysAgo(20),
    },
    {
      type: "note" as const,
      subject: "NexGen shortlisted us",
      body: "David confirmed we're in the top 2. Competitor is Salesforce. Final decision expected within 10 days.",
      contactId: byName["David Kim"],
      dealId: dealByTitle["NexGen CRM Migration"],
      createdAt: daysAgo(2),
      updatedAt: daysAgo(2),
    },
    {
      type: "email" as const,
      subject: "BlueWave contract signed — onboarding next steps",
      body: "Emily signed the MSA. Looped in the onboarding team. Kick-off call confirmed for Tuesday.",
      contactId: byName["Emily Harrison"],
      dealId: dealByTitle["BlueWave Marketing Suite Expansion"],
      completedAt: daysAgo(7),
      createdAt: daysAgo(7),
      updatedAt: daysAgo(7),
    },
    {
      type: "call" as const,
      subject: "Intro call with Lisa Thompson",
      body: "Early exploration call. Lisa is comparing 4 tools. Budget not yet approved.",
      contactId: byName["Lisa Thompson"],
      dealId: dealByTitle["PivotSoft Starter Package"],
      completedAt: daysAgo(14),
      createdAt: daysAgo(14),
      updatedAt: daysAgo(14),
    },
    {
      type: "task" as const,
      subject: "Follow up with Lisa on budget approval",
      body: "Send a one-pager with ROI data to share with her finance team.",
      contactId: byName["Lisa Thompson"],
      dealId: dealByTitle["PivotSoft Starter Package"],
      dueAt: daysAgo(-7),
      createdAt: daysAgo(10),
      updatedAt: daysAgo(10),
    },
    {
      type: "meeting" as const,
      subject: "CloudFirst full product demo",
      body: "James liked the UX but raised pricing objections. Competitor offered on-premise at 40% lower cost.",
      contactId: byName["James O'Brien"],
      dealId: dealByTitle["CloudFirst Integration Project"],
      completedAt: daysAgo(60),
      createdAt: daysAgo(60),
      updatedAt: daysAgo(60),
    },
    {
      type: "note" as const,
      subject: "CloudFirst deal lost",
      body: "James confirmed they chose a competitor. Their contract is 2 years — re-engage in Q3 next year.",
      contactId: byName["James O'Brien"],
      dealId: dealByTitle["CloudFirst Integration Project"],
      createdAt: daysAgo(15),
      updatedAt: daysAgo(15),
    },
    {
      type: "call" as const,
      subject: "Trial review call — InnovateCo",
      body: "Rachel's team of 5 has been in trial for 3 weeks. NPS score of 9. Ready to close on Growth plan.",
      contactId: byName["Rachel Patel"],
      dealId: dealByTitle["InnovateCo Growth Plan"],
      completedAt: daysAgo(8),
      createdAt: daysAgo(8),
      updatedAt: daysAgo(8),
    },
    {
      type: "email" as const,
      subject: "InnovateCo final contract sent for signature",
      body: "Attached signed MSA and SOW. Requested countersignature by EOW.",
      contactId: byName["Rachel Patel"],
      dealId: dealByTitle["InnovateCo Growth Plan"],
      completedAt: daysAgo(2),
      createdAt: daysAgo(2),
      updatedAt: daysAgo(2),
    },
    {
      type: "meeting" as const,
      subject: "Summit Analytics stakeholder presentation",
      body: "Presented 3-year ROI analysis to Tom and the IT Director. Positive reception — IT requested security docs.",
      contactId: byName["Tom Walker"],
      dealId: dealByTitle["Summit Analytics Expansion"],
      completedAt: daysAgo(12),
      createdAt: daysAgo(12),
      updatedAt: daysAgo(12),
    },
    {
      type: "email" as const,
      subject: "Revised 3-year proposal sent to Summit Analytics",
      body: "Updated proposal addressing IT security requirements and added DPA appendix.",
      contactId: byName["Tom Walker"],
      dealId: dealByTitle["Summit Analytics Expansion"],
      completedAt: daysAgo(4),
      createdAt: daysAgo(4),
      updatedAt: daysAgo(4),
    },
  ]);
}
