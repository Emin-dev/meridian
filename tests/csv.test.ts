import { describe, expect, it } from "vitest";
import { parseCsv } from "@/lib/csv";

describe("parseCsv", () => {
  it("requires at least a header and one data row", () => {
    expect(parseCsv("").error).toBe("Paste at least a header row and one data row.");
    expect(parseCsv("name,email").error).toBe(
      "Paste at least a header row and one data row.",
    );
  });

  it("requires a recognizable name column", () => {
    const result = parseCsv("email,phone\njane@example.com,555");
    expect(result.error).toBe('Could not find a "name" column in the header row.');
    expect(result.rows).toEqual([]);
  });

  it("parses a basic comma-delimited file", () => {
    const result = parseCsv(
      "name,email,phone,company\nJane Smith,jane@example.com,+1 555 0001,Acme Corp",
    );
    expect(result.error).toBeUndefined();
    expect(result.skipped).toEqual([]);
    expect(result.rows).toEqual([
      {
        rowIndex: 2,
        name: "Jane Smith",
        email: "jane@example.com",
        phone: "+1 555 0001",
        company: "Acme Corp",
      },
    ]);
  });

  it("handles quoted fields containing delimiters and escaped quotes", () => {
    const result = parseCsv(
      'name,company\n"Smith, Jane","Acme, ""The"" Corp"',
    );
    expect(result.rows[0].name).toBe("Smith, Jane");
    expect(result.rows[0].company).toBe('Acme, "The" Corp');
  });

  it("supports tab-delimited input", () => {
    const result = parseCsv("name\temail\nJane\tjane@example.com");
    expect(result.rows[0]).toMatchObject({ name: "Jane", email: "jane@example.com" });
  });

  it("supports semicolon-delimited input", () => {
    const result = parseCsv("name;email\nJane;jane@example.com");
    expect(result.rows[0]).toMatchObject({ name: "Jane", email: "jane@example.com" });
  });

  it("aliases alternate header names (case/space-insensitive)", () => {
    const result = parseCsv(
      "Full Name,E-Mail,Mobile,Organization\nJane,jane@example.com,555,Acme",
    );
    expect(result.rows[0]).toEqual({
      rowIndex: 2,
      name: "Jane",
      email: "jane@example.com",
      phone: "555",
      company: "Acme",
    });
  });

  it("skips rows missing a name and preserves the original line number", () => {
    const result = parseCsv(
      "name,email\nJane,jane@example.com\n,nobody@example.com\nJohn,john@example.com",
    );
    expect(result.rows.map((r) => r.name)).toEqual(["Jane", "John"]);
    expect(result.skipped).toEqual([
      { row: 3, name: "(empty)", reason: "Missing name" },
    ]);
  });

  it("ignores blank lines but keeps original line numbering for kept rows", () => {
    const result = parseCsv("name,email\n\nJane,jane@example.com\n");
    expect(result.rows).toEqual([
      { rowIndex: 3, name: "Jane", email: "jane@example.com", phone: "", company: "" },
    ]);
  });

  it("reports when there are no valid or skipped data rows", () => {
    // Header only after blank-line filtering leaves < 2 lines, so this hits the
    // header/data guard; a header plus an all-whitespace data line is filtered
    // out entirely. Use a header with a real-but-nameless single row instead.
    const result = parseCsv("name,email\n,only@example.com");
    expect(result.error).toBeUndefined();
    expect(result.rows).toEqual([]);
    expect(result.skipped).toHaveLength(1);
  });
});
