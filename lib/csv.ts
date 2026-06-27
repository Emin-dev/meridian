import type { ImportSkippedRow } from "@/app/(app)/contacts/actions";

export type { ImportSkippedRow };

/**
 * Escape a single value for inclusion in a CSV cell. Quotes fields that contain
 * the delimiter, quotes, or newlines (doubling embedded quotes), and neutralizes
 * spreadsheet formula injection by prefixing a leading `'` when the value begins
 * with a character a spreadsheet would treat as a formula (`= + - @`, tab, or CR).
 * Shared by the contacts and deals export routes so they stay in sync.
 */
export function escapeCsv(value: string | null | undefined): string {
  if (value == null) return "";
  let str = String(value);
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export interface ParsedRow {
  rowIndex: number;
  name: string;
  email: string;
  phone: string;
  company: string;
}

export interface ParseCsvResult {
  rows: ParsedRow[];
  skipped: ImportSkippedRow[];
  error?: string;
}

/**
 * Pure CSV parser for contact imports. Handles quoted fields (with `""`
 * escaping), comma/tab/semicolon delimiters, header aliasing, and skips
 * rows that are missing a name. No React or DOM dependencies.
 */
export function parseCsv(text: string): ParseCsvResult {
  const lines = text
    .split(/\r?\n/)
    .map((l, idx) => ({ raw: l.trim(), lineNo: idx + 1 }))
    .filter((e) => e.raw);
  if (lines.length < 2)
    return { rows: [], skipped: [], error: "Paste at least a header row and one data row." };

  const parseFields = (line: string): string[] => {
    const fields: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if ((ch === "," || ch === "\t" || ch === ";") && !inQuotes) {
        fields.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    fields.push(current.trim());
    return fields;
  };

  const headers = parseFields(lines[0].raw).map((h) => h.toLowerCase().replace(/\s+/g, ""));
  const colIndex = (candidates: string[]) =>
    candidates.reduce((found, c) => (found !== -1 ? found : headers.indexOf(c)), -1);

  const nameIdx = colIndex(["name", "fullname", "full_name", "contact"]);
  const emailIdx = colIndex(["email", "emailaddress", "e-mail"]);
  const phoneIdx = colIndex(["phone", "phonenumber", "phone_number", "mobile", "tel"]);
  const companyIdx = colIndex(["company", "organization", "org", "account"]);

  if (nameIdx === -1)
    return { rows: [], skipped: [], error: 'Could not find a "name" column in the header row.' };

  const rows: ParsedRow[] = [];
  const skipped: ImportSkippedRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const csvLineNumber = lines[i].lineNo; // original paste line, blank lines preserved
    const fields = parseFields(lines[i].raw);
    const name = nameIdx !== -1 ? (fields[nameIdx] ?? "") : "";
    if (!name) {
      skipped.push({ row: csvLineNumber, name: "(empty)", reason: "Missing name" });
      continue;
    }
    rows.push({
      rowIndex: csvLineNumber,
      name,
      email: emailIdx !== -1 ? (fields[emailIdx] ?? "") : "",
      phone: phoneIdx !== -1 ? (fields[phoneIdx] ?? "") : "",
      company: companyIdx !== -1 ? (fields[companyIdx] ?? "") : "",
    });
  }

  if (rows.length === 0 && skipped.length === 0)
    return { rows: [], skipped: [], error: "No valid data rows found." };
  return { rows, skipped };
}
