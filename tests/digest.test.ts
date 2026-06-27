import { describe, expect, it } from "vitest";
import { parseDailyDigest, parseWeeklyDigest } from "@/lib/digest";

describe("parseDailyDigest", () => {
  it("parses a clean JSON bullets object", () => {
    const raw = JSON.stringify({ bullets: ["Call Acme", "Send proposal"] });
    expect(parseDailyDigest(raw)).toEqual(["Call Acme", "Send proposal"]);
  });

  it("unwraps a fenced ```json response without mangling first/last item", () => {
    const raw = '```json\n{"bullets":["First","Last"]}\n```';
    expect(parseDailyDigest(raw)).toEqual(["First", "Last"]);
  });

  it("strips leading bullet characters and blank entries", () => {
    const raw = JSON.stringify({ bullets: ["• Follow up", "  ", "- Email"] });
    expect(parseDailyDigest(raw)).toEqual(["Follow up", "Email"]);
  });

  it("drops non-string elements instead of throwing", () => {
    const raw = JSON.stringify({ bullets: ["Keep", 42, null, "Also"] });
    expect(parseDailyDigest(raw)).toEqual(["Keep", "Also"]);
  });

  it("returns [] when bullets is not an array", () => {
    expect(parseDailyDigest(JSON.stringify({ bullets: "nope" }))).toEqual([]);
  });

  it("returns [] on malformed / non-JSON input", () => {
    expect(parseDailyDigest("not json at all")).toEqual([]);
    expect(parseDailyDigest("")).toEqual([]);
  });
});

describe("parseWeeklyDigest", () => {
  it("parses the three sections in canonical order", () => {
    const raw = JSON.stringify({
      wins: "Closed Acme",
      atRisk: "Beta stalled",
      priorities: "Push Gamma",
    });
    expect(parseWeeklyDigest(raw)).toEqual([
      { key: "wins", body: "Closed Acme" },
      { key: "atRisk", body: "Beta stalled" },
      { key: "priorities", body: "Push Gamma" },
    ]);
  });

  it("unwraps a fenced response", () => {
    const raw = '```json\n{"wins":"W","atRisk":"R","priorities":"P"}\n```';
    expect(parseWeeklyDigest(raw)).toEqual([
      { key: "wins", body: "W" },
      { key: "atRisk", body: "R" },
      { key: "priorities", body: "P" },
    ]);
  });

  it("omits missing, empty, and non-string sections", () => {
    const raw = JSON.stringify({ wins: "W", atRisk: "   ", priorities: 5 });
    expect(parseWeeklyDigest(raw)).toEqual([{ key: "wins", body: "W" }]);
  });

  it("returns [] on malformed / non-JSON input", () => {
    expect(parseWeeklyDigest("garbage")).toEqual([]);
    expect(parseWeeklyDigest("")).toEqual([]);
  });
});
