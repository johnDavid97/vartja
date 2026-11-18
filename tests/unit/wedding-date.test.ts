import { describe, expect, it } from "vitest";
import { formatWeddingDate } from "../../lib/wedding-date";

describe("shared wedding date formatting", () => {
  it("preserves a calendar date without converting it through the viewer timezone", () => {
    expect(formatWeddingDate("2027-07-27")).toBe("27. juli 2027");
    expect(formatWeddingDate("2028-02-29")).toBe("29. februar 2028");
  });
  it("uses Oslo summer time for absolute timestamps", () => {
    expect(formatWeddingDate("2027-07-26T22:30:00Z")).toBe("27. juli 2027");
    expect(formatWeddingDate("2027-07-26T18:30:00-04:00")).toBe("27. juli 2027");
  });
  it("uses Oslo winter time rather than a fixed UTC offset", () => {
    expect(formatWeddingDate("2027-01-26T22:30:00Z")).toBe("26. januar 2027");
    expect(formatWeddingDate("2027-01-26T23:30:00Z")).toBe("27. januar 2027");
  });
  it.each(["", "not-a-date", "2027-02-29", "2027-02-31", "2027-13-01"])('handles invalid date "%s"', (date) => {
    expect(formatWeddingDate(date)).toBe("Dato kommer");
  });
});
