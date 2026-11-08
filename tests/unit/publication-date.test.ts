import { describe, expect, it } from "vitest";
import { publicationISO, publicationParts } from "@/lib/publication-date";

describe("Norwegian publication dates", () => {
  it("converts winter wall-clock time to UTC", () => {
    expect(publicationISO("2026-11-02", "12:00")).toBe("2026-11-02T11:00:00.000Z");
  });
  it("accounts for summer time", () => {
    expect(publicationISO("2026-07-02", "12:00")).toBe("2026-07-02T10:00:00.000Z");
  });
  it("uses Oslo's calendar date near midnight", () => {
    expect(publicationParts("2026-07-01T23:30:00Z")).toEqual({ day: "2026-07-02", time: "01:30" });
  });
  it("rejects nonexistent daylight-saving times", () => {
    expect(publicationISO("2026-03-29", "02:30")).toBeNull();
  });
  it("rejects malformed or impossible inputs", () => {
    expect(publicationISO("2026-02-30", "12:00")).toBeNull();
    expect(publicationISO("2026-11-02", "25:00")).toBeNull();
    expect(publicationISO("bad", "12:00")).toBeNull();
  });
});
