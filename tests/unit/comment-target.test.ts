import { describe, expect, it } from "vitest";
import { commentFingerprintScope, commentScope, validateCommentTarget, parseModerationInput, type CommentTarget } from "@/features/comments/validation";

describe("comment target boundaries", () => {
  it("strictly validates moderation IDs and statuses without coercion", () => {
    expect(parseModerationInput({ id: 1, status: "hidden" })).toEqual({ id: 1, status: "hidden" });
    for (const input of [null, { id: 0, status: "hidden" }, { id: 2147483648, status: "hidden" }, { id: 1, status: ["hidden"] }, { id: 1, status: "hidden", body: "edit" }]) {
      expect(() => parseModerationInput(input)).toThrow();
    }
  });
  it("keeps numeric-looking program days separate from posts", () => {
    const day: CommentTarget = { kind: "program-day", id: "123" };
    const post: CommentTarget = { kind: "post", id: "123" };
    expect(commentScope(day)).toEqual({ and: [{ source: { equals: "program-day" } }, { dayId: { equals: "123" } }] });
    expect(commentScope(post)).toEqual({ and: [{ source: { equals: "post" } }, { postId: { equals: 123 } }] });
    expect(commentFingerprintScope(day)).toBe("123");
    expect(commentFingerprintScope(post)).toEqual(["post", 123]);
    expect(commentFingerprintScope({ kind: "post", id: "00123" })).toEqual(["post", 123]);
  });
  it.each(["0", "-1", "1.5", "1e2", "abc", "2147483648", "99999999999999999999"])("rejects invalid post ID %s", (id) => {
    expect(() => validateCommentTarget({ kind: "post", id })).toThrow();
  });
  it("accepts current targets and rejects malformed program IDs", () => {
    expect(() => validateCommentTarget({ kind: "post", id: "2147483647" })).not.toThrow();
    expect(() => validateCommentTarget({ kind: "program-day", id: "day-one_2" })).not.toThrow();
    expect(() => validateCommentTarget({ kind: "program-day", id: "../posts" })).toThrow();
  });
});
