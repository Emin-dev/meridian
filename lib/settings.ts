import { getDb, schema } from "@/db";

export interface CrmSettings {
  displayName: string;
  defaultCurrency: string;
  defaultDealStage: string;
}

export const CRM_SETTINGS_DEFAULTS: CrmSettings = {
  displayName: "",
  defaultCurrency: "USD",
  defaultDealStage: "lead",
};

export async function getCrmSettings(): Promise<CrmSettings> {
  const db = getDb();
  if (!db) return { ...CRM_SETTINGS_DEFAULTS };

  try {
    const rows = await db.select().from(schema.appSettings);
    const result: CrmSettings = { ...CRM_SETTINGS_DEFAULTS };
    for (const row of rows) {
      if (
        row.key === "displayName" ||
        row.key === "defaultCurrency" ||
        row.key === "defaultDealStage"
      ) {
        result[row.key as keyof CrmSettings] = row.value;
      }
    }
    return result;
  } catch {
    return { ...CRM_SETTINGS_DEFAULTS };
  }
}
