import type { getDb } from "./index";
import {
  contacts,
  deals,
  activities,
  sequences,
  sequenceSteps,
  contactSequenceEnrollments,
  dealEvents,
  appSettings,
} from "./schema";

type Db = NonNullable<ReturnType<typeof getDb>>;

const daysAgo = (n: number): Date => new Date(Date.now() - n * 86_400_000);

/**
 * Small, realistic Baku (Azerbaijan) demo dataset — just enough in every part
 * of the app to demonstrate functionality. Clears existing rows first so the
 * demo set stays small and fresh.
 */
export async function insertDemoData(db: Db): Promise<void> {
  // FK-safe clear order.
  await db.delete(contactSequenceEnrollments);
  await db.delete(sequenceSteps);
  await db.delete(sequences);
  await db.delete(dealEvents);
  await db.delete(activities);
  await db.delete(deals);
  await db.delete(contacts);

  // ── Contacts (5, Baku) ──
  const insertedContacts = await db
    .insert(contacts)
    .values([
      {
        name: "Kamran Quliyev",
        email: "kamran.quliyev@caspiandigital.az",
        phone: "+994 50 234 56 78",
        company: "Caspian Digital",
        title: "Commercial Director",
        notes: "Wants AI lead scoring and pipeline reporting. Active pilot.",
        status: "active" as const,
        source: "referral" as const,
        owner: "Elvin Məmmədov",
        tags: ["vip"],
        leadScore: 84,
        leadScoreRationale: "Decision maker, active pilot, clear budget.",
        leadScoredAt: daysAgo(2),
        createdAt: daysAgo(40),
        updatedAt: daysAgo(2),
      },
      {
        name: "Aysel Məmmədova",
        email: "aysel.mammadova@bakutechhub.az",
        phone: "+994 55 345 67 89",
        company: "Baku Tech Hub",
        title: "Operations Lead",
        notes: "Comparing two CRMs; price sensitive.",
        status: "lead" as const,
        source: "website" as const,
        owner: "Nigar Əliyeva",
        tags: ["inbound"],
        leadScore: 61,
        leadScoreRationale: "Engaged but budget approval pending.",
        leadScoredAt: daysAgo(6),
        createdAt: daysAgo(20),
        updatedAt: daysAgo(4),
      },
      {
        name: "Orxan Səfərov",
        email: "orxan.seferov@azerisoft.az",
        phone: "+994 70 456 78 90",
        company: "AzeriSoft",
        title: "CEO",
        notes: "Existing customer — expanding to the sales team.",
        status: "active" as const,
        source: "linkedin" as const,
        owner: "Elvin Məmmədov",
        tags: ["customer"],
        leadScore: 77,
        leadScoreRationale: "Proven ROI; expansion opportunity.",
        leadScoredAt: daysAgo(10),
        createdAt: daysAgo(70),
        updatedAt: daysAgo(8),
      },
      {
        name: "Leyla Hüseynova",
        email: "leyla.huseynova@portbaku.az",
        phone: "+994 51 567 89 01",
        company: "Port Baku Mall",
        title: "Marketing Manager",
        notes: "Inbound from website; wants a short pilot first.",
        status: "lead" as const,
        source: "website" as const,
        owner: "Nigar Əliyeva",
        tags: [],
        leadScore: 48,
        leadScoreRationale: "New inbound; needs discovery call.",
        leadScoredAt: daysAgo(3),
        createdAt: daysAgo(8),
        updatedAt: daysAgo(3),
      },
      {
        name: "Tural Əhmədov",
        email: "tural.ahmadov@nargizgroup.az",
        phone: "+994 50 678 90 12",
        company: "Nargiz Group",
        title: "IT Manager",
        notes: "Went quiet after demo; re-engage next quarter.",
        status: "inactive" as const,
        source: "cold-outreach" as const,
        owner: "Elvin Məmmədov",
        tags: [],
        leadScore: 40,
        leadScoreRationale: "Stalled; revisit later.",
        leadScoredAt: daysAgo(15),
        createdAt: daysAgo(55),
        updatedAt: daysAgo(15),
      },
    ])
    .returning({ id: contacts.id, name: contacts.name });

  const c: Record<string, number> = {};
  for (const x of insertedContacts) c[x.name] = x.id;

  // ── Deals (4, AZN) ──
  const insertedDeals = await db
    .insert(deals)
    .values([
      {
        title: "Caspian Digital — CRM rollout",
        stage: "negotiation" as const,
        value: "18000",
        currency: "AZN",
        probability: 70,
        contactId: c["Kamran Quliyev"],
        expectedCloseDate: daysAgo(-12),
        notes: "Pricing agreed; contract in legal review.",
        owner: "Elvin Məmmədov",
        createdAt: daysAgo(35),
        updatedAt: daysAgo(2),
      },
      {
        title: "Baku Tech Hub — Annual license",
        stage: "proposal" as const,
        value: "9500",
        currency: "AZN",
        probability: 40,
        contactId: c["Aysel Məmmədova"],
        expectedCloseDate: daysAgo(-25),
        notes: "Proposal sent; awaiting feedback.",
        owner: "Nigar Əliyeva",
        createdAt: daysAgo(18),
        updatedAt: daysAgo(4),
      },
      {
        title: "AzeriSoft — Sales team expansion",
        stage: "won" as const,
        value: "24000",
        currency: "AZN",
        probability: 100,
        contactId: c["Orxan Səfərov"],
        expectedCloseDate: daysAgo(6),
        notes: "Signed. Onboarding scheduled.",
        owner: "Elvin Məmmədov",
        createdAt: daysAgo(60),
        updatedAt: daysAgo(6),
      },
      {
        title: "Port Baku — Pilot",
        stage: "qualified" as const,
        value: "6000",
        currency: "AZN",
        probability: 25,
        contactId: c["Leyla Hüseynova"],
        expectedCloseDate: daysAgo(-40),
        notes: "Discovery done; 2-week pilot proposed.",
        owner: "Nigar Əliyeva",
        createdAt: daysAgo(8),
        updatedAt: daysAgo(3),
      },
    ])
    .returning({ id: deals.id, title: deals.title });

  const d: Record<string, number> = {};
  for (const x of insertedDeals) d[x.title] = x.id;

  // ── Activities (6, incl. tasks) ──
  await db.insert(activities).values([
    {
      type: "call" as const,
      subject: "Discovery call — Caspian Digital",
      body: "Mapped requirements: AI scoring + reports. Strong fit.",
      contactId: c["Kamran Quliyev"],
      dealId: d["Caspian Digital — CRM rollout"],
      completedAt: daysAgo(30),
      createdAt: daysAgo(30),
      updatedAt: daysAgo(30),
    },
    {
      type: "email" as const,
      subject: "Proposal sent — Baku Tech Hub",
      body: "Annual license proposal with onboarding plan.",
      contactId: c["Aysel Məmmədova"],
      dealId: d["Baku Tech Hub — Annual license"],
      completedAt: daysAgo(7),
      createdAt: daysAgo(7),
      updatedAt: daysAgo(7),
    },
    {
      type: "meeting" as const,
      subject: "Kickoff — AzeriSoft",
      body: "Onboarding kickoff with Orxan's team.",
      contactId: c["Orxan Səfərov"],
      dealId: d["AzeriSoft — Sales team expansion"],
      completedAt: daysAgo(5),
      createdAt: daysAgo(5),
      updatedAt: daysAgo(5),
    },
    {
      type: "note" as const,
      subject: "Port Baku — pilot interest",
      body: "Leyla wants a 2-week pilot before committing.",
      contactId: c["Leyla Hüseynova"],
      dealId: d["Port Baku — Pilot"],
      createdAt: daysAgo(3),
      updatedAt: daysAgo(3),
    },
    {
      type: "task" as const,
      subject: "Send contract to Caspian Digital",
      body: "Email the final MSA for signature.",
      contactId: c["Kamran Quliyev"],
      dealId: d["Caspian Digital — CRM rollout"],
      dueAt: daysAgo(-2),
      createdAt: daysAgo(2),
      updatedAt: daysAgo(2),
    },
    {
      type: "task" as const,
      subject: "Follow up with Aysel on proposal",
      body: "Check proposal feedback and book a call.",
      contactId: c["Aysel Məmmədova"],
      dueAt: daysAgo(1),
      createdAt: daysAgo(5),
      updatedAt: daysAgo(5),
    },
  ]);

  // ── One sequence (2 steps) + one enrollment ──
  const [seq] = await db
    .insert(sequences)
    .values({
      name: "New lead nurture",
      status: "active" as const,
      createdAt: daysAgo(20),
      updatedAt: daysAgo(20),
    })
    .returning({ id: sequences.id });

  await db.insert(sequenceSteps).values([
    {
      sequenceId: seq.id,
      position: 1,
      delayDays: 0,
      subjectTemplate: "Salam {{firstName}} — quick intro",
      bodyTemplate:
        "Thanks for your interest in Meridian. Could we set up a short call this week?",
    },
    {
      sequenceId: seq.id,
      position: 2,
      delayDays: 3,
      subjectTemplate: "Following up, {{firstName}}",
      bodyTemplate:
        "Just checking in — happy to give a quick 15-minute demo whenever suits you.",
    },
  ]);

  await db.insert(contactSequenceEnrollments).values({
    contactId: c["Leyla Hüseynova"],
    sequenceId: seq.id,
    status: "active" as const,
    currentStepPosition: 1,
    enrolledAt: daysAgo(4),
  });

  // ── App settings (demonstrate Settings) ──
  await db
    .insert(appSettings)
    .values([
      { key: "defaultCurrency", value: "AZN" },
      { key: "owner_display_name", value: "Elvin Məmmədov" },
    ])
    .onConflictDoNothing();
}
