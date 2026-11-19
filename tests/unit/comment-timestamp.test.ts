import { describe, expect, it } from "vitest";
import { formatCommentAge } from "@/features/comments/timestamp";

const now = new Date("2027-07-27T12:00:00.000Z");

describe("comment timestamp presentation", () => {
  it.each([
    ["2027-07-27T11:59:31.000Z", "nå"],
    ["2027-07-27T11:55:00.000Z", "5 min"],
    ["2027-07-27T07:00:00.000Z", "5 t"],
    ["2027-07-25T12:00:00.000Z", "2 d"],
  ])("formats %s relative to an explicit clock", (createdAt, expected) => {
    expect(formatCommentAge(createdAt, now)).toBe(expected);
  });

  it("does not show a negative age for clock skew", () => {
    expect(formatCommentAge("2027-07-27T12:01:00.000Z", now)).toBe("nå");
  });
});
