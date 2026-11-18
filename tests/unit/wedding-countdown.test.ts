import { describe, expect, it } from "vitest";
import { calculateWeddingCountdown } from "@/lib/wedding-countdown";

describe("calculateWeddingCountdown", () => {
  const now = Date.parse("2027-07-25T10:00:00.000Z");

  it("returns display-ready days, hours, minutes, and seconds", () => {
    expect(
      calculateWeddingCountdown("2027-07-27T12:03:04.000Z", now),
    ).toEqual({
      status: "upcoming",
      days: 2,
      hours: 2,
      minutes: 3,
      seconds: 4,
      totalSeconds: 180_184,
    });
  });

  it("rounds a partial final second up instead of showing zero early", () => {
    expect(calculateWeddingCountdown(now + 1, now)).toMatchObject({
      status: "upcoming",
      totalSeconds: 1,
      seconds: 1,
    });
  });

  it("marks the exact target and past dates as elapsed without making a marriage claim", () => {
    expect(calculateWeddingCountdown(now, now).status).toBe("elapsed");
    expect(calculateWeddingCountdown(now - 1, now).status).toBe("elapsed");
  });

  it("handles invalid dates and timestamps", () => {
    expect(calculateWeddingCountdown("not-a-date", now).status).toBe("invalid");
    expect(calculateWeddingCountdown(now + 1_000, Number.NaN).status).toBe("invalid");
  });
});
