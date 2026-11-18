import { describe, expect, it, vi } from "vitest";
import { buildPollOverview, LoadPollOverview, type PollPost, type PollVoteCount } from "@/features/polls/overview";
import type { PollDefinition } from "@/lib/polls";

const poll: PollDefinition = { id: "p1", question: "Buss?", open: true, options: [{ id: "yes", label: "Ja" }, { id: "no", label: "Nei" }] };
const body = (...polls: PollDefinition[]) => ({ root: { children: polls.map((item) => ({ type: "block", fields: { ...item, blockType: "poll" } })) } });
const post: PollPost = { id: 1, title: "Transport", body: body(poll), _status: "published", visibility: "public" };
const vote = (overrides: Partial<PollVoteCount> = {}): PollVoteCount => ({ postId: 1, pollId: poll.id, optionId: "yes", count: 3, definition: poll, ...overrides });

describe("poll overview", () => {
  it("combines counts by post, poll and option, including zero-vote choices", () => {
    const [row] = buildPollOverview([post], [post], [vote(), vote({ optionId: "no", count: 2 })]);
    expect(row).toMatchObject({ status: "open", total: 5, hasDraftChanges: false });
    expect(row.options.map((option) => option.count)).toEqual([3, 2]);
    expect(buildPollOverview([post], [post], [vote()])[0].options[1].count).toBe(0);
  });
  it("does not confuse identical poll IDs in different posts", () => {
    const rows = buildPollOverview([post, { ...post, id: 2 }], [], [vote()]);
    expect(rows.map((row) => row.total).sort()).toEqual([0, 3]);
    expect(new Set(rows.map((row) => row.key)).size).toBe(2);
  });
  it("keeps published settings when a newer draft closes or removes a poll", () => {
    for (const draftBody of [body({ ...poll, open: false }), body()]) {
      const [row] = buildPollOverview([post], [{ ...post, _status: "draft", body: draftBody }], [vote()]);
      expect(row).toMatchObject({ status: "open", hasDraftChanges: true, total: 3 });
    }
  });
  it("includes draft-only polls without claiming that voting is open", () => {
    const draft = { ...post, _status: "draft" };
    expect(buildPollOverview([draft], [draft], [])[0].status).toBe("draft");
  });
  it("preserves removed poll results and unknown historical choices", () => {
    const removed = { ...post, body: body() };
    const [row] = buildPollOverview([removed], [removed], [vote(), vote({ optionId: "old", count: 1 })]);
    expect(row).toMatchObject({ status: "archived", question: poll.question, total: 4 });
    expect(row.options.at(-1)).toEqual({ id: "old", label: "Tidligere svaralternativ", count: 1 });
  });
  it("does not expose ballots for posts missing from the authorized post set", () => {
    expect(buildPollOverview([], [], [vote()])).toEqual([]);
  });
  it("marks private and closed polls, ignoring incomplete definitions", () => {
    expect(buildPollOverview([{ ...post, visibility: "private", body: body({ ...poll, open: false }) }], [], [])[0]).toMatchObject({ private: true, status: "closed" });
    expect(buildPollOverview([], [{ ...post, body: body({ ...poll, question: "" }) }], [])).toEqual([]);
  });
  it("loads via an injected repository and propagates failures rather than showing zero votes", async () => {
    const repository = { readPosts: vi.fn().mockResolvedValue({ saved: [post], drafts: [post] }), readVoteCounts: vi.fn().mockResolvedValue([vote()]) };
    expect((await new LoadPollOverview(repository).execute())[0].total).toBe(3);
    repository.readVoteCounts.mockRejectedValue(new Error("unavailable"));
    await expect(new LoadPollOverview(repository).execute()).rejects.toThrow("unavailable");
  });
});
