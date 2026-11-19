import { describe, expect, it } from "vitest";
import { DEFAULT_WEDDING_NAMES, weddingBranding, weddingTitle } from "@/features/wedding-site/branding";
import { toHomepageSettings } from "@/features/homepage/settings";
import type { Wedding } from "@/payload-types";

describe("shared wedding identity", () => {
  it.each([
    ["Andrea & Martin", "A&M"],
    ["  Åse og Øyvind  ", "Å&Ø"],
    ["Anne-Marie + Jean-Luc", "A&J"],
    ["Åse&Øyvind", "Å&Ø"],
    ["A\u030ase & Émile", "Å&É"],
    ["Alex", "A"],
    ["Anna Maria", "AM"],
  ])("derives %s without hard-coded initials", (names, monogram) => {
    expect(weddingBranding(names)).toEqual({ names: names.trim(), monogram });
  });

  it.each([undefined, null, "", "   ", DEFAULT_WEDDING_NAMES])("uses a neutral fallback for %s", (names) => {
    expect(weddingBranding(names)).toEqual({ names: DEFAULT_WEDDING_NAMES, monogram: "♡" });
  });

  it("keeps configured names literal in titles rather than treating them as templates", () => {
    const branding = weddingBranding("%s & <Alex>");
    expect(weddingTitle("Program", branding)).toBe("Program · %s & <Alex>");
  });

  it("shares the homepage fallback without modifying settings", () => {
    const source = { id: 1, coupleNames: "", weddingDate: "2027-07-27", heroBackgroundMode: "color", heroBackgroundColor: "#3c4641" } satisfies Wedding;
    const snapshot = structuredClone(source);
    expect(toHomepageSettings(source).names).toBe(DEFAULT_WEDDING_NAMES);
    expect(source).toEqual(snapshot);
  });
});
