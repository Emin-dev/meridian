import { describe, expect, it } from "vitest";
import { interpolate, type TemplateVars } from "@/lib/template";

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
});
