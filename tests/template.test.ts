import { describe, expect, it } from "vitest";
import {
  contactToVars,
  interpolate,
  PLACEHOLDER_VARS,
  type TemplateVars,
} from "@/lib/template";

const vars: TemplateVars = {
  firstName: "Ada",
  lastName: "Lovelace",
  company: "Analytical Engines",
  ownerName: "Charles",
};

describe("interpolate", () => {
  it("replaces known tokens with provided values", () => {
    expect(interpolate("Hi {{firstName}} at {{company}}", vars)).toBe(
      "Hi Ada at Analytical Engines",
    );
  });

  it("leaves unknown tokens untouched", () => {
    expect(interpolate("{{firstName}} — {{unknownToken}}", vars)).toBe(
      "Ada — {{unknownToken}}",
    );
  });

  it("replaces every occurrence of a repeated token", () => {
    expect(interpolate("{{firstName}} {{firstName}}", vars)).toBe("Ada Ada");
  });

  it("returns the template unchanged when there are no tokens", () => {
    expect(interpolate("plain text", vars)).toBe("plain text");
  });
});

describe("contactToVars", () => {
  it("splits a full name into first and last", () => {
    expect(
      contactToVars({ name: "Ada Lovelace", company: "Analytical Engines", owner: "Charles" }),
    ).toEqual({
      firstName: "Ada",
      lastName: "Lovelace",
      company: "Analytical Engines",
      ownerName: "Charles",
    });
  });

  it("keeps multi-word surnames intact", () => {
    expect(
      contactToVars({ name: "Ada B C Lovelace", company: "Acme", owner: "Owner" }),
    ).toMatchObject({ firstName: "Ada", lastName: "B C Lovelace" });
  });

  it("falls back to placeholders for missing fields", () => {
    expect(
      contactToVars({ name: "Ada", company: null, owner: null }),
    ).toEqual({
      firstName: "Ada",
      lastName: PLACEHOLDER_VARS.lastName,
      company: PLACEHOLDER_VARS.company,
      ownerName: PLACEHOLDER_VARS.ownerName,
    });
  });

  it("interpolates cleanly from contactToVars output", () => {
    const v = contactToVars({ name: "Grace Hopper", company: "Navy", owner: "Lee" });
    expect(interpolate("Hi {{firstName}} {{lastName}} ({{company}})", v)).toBe(
      "Hi Grace Hopper (Navy)",
    );
  });
});
