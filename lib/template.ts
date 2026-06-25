export interface TemplateVars {
  firstName: string;
  lastName: string;
  company: string;
  ownerName: string;
}

export const PLACEHOLDER_VARS: TemplateVars = {
  firstName: "[First Name]",
  lastName: "[Last Name]",
  company: "[Company]",
  ownerName: "[Owner Name]",
};

export function interpolate(template: string, vars: TemplateVars): string {
  return template
    .replace(/\{\{firstName\}\}/g, vars.firstName)
    .replace(/\{\{lastName\}\}/g, vars.lastName)
    .replace(/\{\{company\}\}/g, vars.company)
    .replace(/\{\{ownerName\}\}/g, vars.ownerName);
}

export function contactToVars(contact: {
  name: string;
  company: string | null;
  owner: string | null;
}): TemplateVars {
  const parts = contact.name.trim().split(/\s+/);
  return {
    firstName: parts[0] ?? contact.name,
    lastName: parts.slice(1).join(" ") || PLACEHOLDER_VARS.lastName,
    company: contact.company ?? PLACEHOLDER_VARS.company,
    ownerName: contact.owner ?? PLACEHOLDER_VARS.ownerName,
  };
}
