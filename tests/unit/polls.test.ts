import { describe, expect, it } from "vitest";
import { getPolls, parsePoll, samePollChoices } from "@/lib/polls";
import { pollVoter, pollVoteKey } from "@/lib/poll-voter";

const poll = {
  id: "poll-1", question: "What should we serve?", open: true,
  options: [{ id: "a", label: "Chicken" }, { id: "b", label: "Vegetarian" }],
};

describe("Poll definitions", () => {
  it("parses a complete poll", () => expect(parsePoll(poll)).toEqual(poll));
  it("rejects fewer than two options", () => expect(parsePoll({ ...poll, options: [poll.options[0]] })).toBeNull());
  it("rejects duplicate answer IDs", () => expect(parsePoll({ ...poll, options: [poll.options[0], { id: "a", label: "Other" }] })).toBeNull());
  it("rejects duplicate labels ignoring case/space", () => expect(parsePoll({ ...poll, options: [poll.options[0], { id: "b", label: " chicken " }] })).toBeNull());
  it("rejects blank questions and malformed definitions", () => {
    expect(parsePoll({ ...poll, question: " " })).toBeNull();
    expect(parsePoll(null)).toBeNull();
  });
  it("finds poll blocks without mistaking photos for polls", () => {
    expect(getPolls({ root: { children: [
      { type: "block", fields: { ...poll, blockType: "poll" } },
      { type: "block", fields: { ...poll, blockType: "photo" } },
    ] } })).toEqual([poll]);
  });
  it("allows moving choices and closing voting without changing vote meaning", () => {
    expect(samePollChoices(poll, { ...poll, open: false, options: [...poll.options].reverse() })).toBe(true);
  });
  it("detects renamed answers or questions", () => {
    expect(samePollChoices(poll, { ...poll, question: "Different question" })).toBe(false);
    expect(samePollChoices(poll, { ...poll, options: [{ id: "a", label: "Fish" }, poll.options[1]] })).toBe(false);
  });
});

describe("Anonymous voter cookies", () => {
  const secret = "test-secret-not-for-production";
  it("issues an HttpOnly cookie and reuses valid identities", () => {
    const voter = pollVoter(null, secret);
    expect(voter.cookie).toContain("HttpOnly");
    expect(voter.cookie).toContain("SameSite=Lax");
    expect(pollVoter(voter.cookie, secret)).toEqual({ id: voter.id, cookie: null });
  });
  it("does not accept forged signatures", () => {
    const voter = pollVoter(null, secret);
    const forged = `sammen-poll-voter=${voter.id}.${"0".repeat(64)}`;
    expect(pollVoter(forged, secret).id).not.toBe(voter.id);
  });
  it("isolates voter keys by post and poll", () => {
    expect(pollVoteKey(1, "a", "voter", secret)).not.toBe(pollVoteKey(2, "a", "voter", secret));
    expect(pollVoteKey(1, "a", "voter", secret)).not.toBe(pollVoteKey(1, "b", "voter", secret));
  });
});
