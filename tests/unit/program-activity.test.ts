import { describe, expect, it } from "vitest";
import { programError, type ProgramData } from "@/lib/program";
import { parseCommentInput } from "@/features/comments/validation";
import { buildPollOverview } from "@/features/polls/overview";
import type { PollDefinition } from "@/lib/polls";

const poll: PollDefinition = { id: "poll", question: "Tar dere bussen?", options: [{ id: "yes", label: "Ja" }, { id: "no", label: "Nei" }], open: true };
const data: ProgramData = { days: [{ id: "day", date: "2027-07-27", label: "Bryllupsdagen", items: [], polls: [poll] }] };
const comment = { requestKey: "11111111-1111-4111-8111-111111111111", body: " Hei! ", parentId: null };

describe("per-day Program activity validation", () => {
  it("retains existing itineraries without polls or comment settings", () => {
    expect(programError({ days: [{ id: "day", date: "2027-07-27", label: "", items: [] }] }, true)).toBeNull();
    expect(programError(data, true)).toBeNull();
  });
  it("allows incomplete draft questions but rejects incomplete publication", () => {
    const draft = structuredClone(data); draft.days[0].polls![0].question = "";
    expect(programError(draft)).toBeNull();
    expect(programError(draft, true)).not.toBeNull();
  });
  it("rejects reused poll/option IDs, invalid settings and oversized poll arrays", () => {
    const duplicate = structuredClone(data); duplicate.days[0].polls!.push(poll);
    expect(programError(duplicate)).not.toBeNull();
    const options = structuredClone(data); options.days[0].polls![0].options[1].id = "yes";
    expect(programError(options)).not.toBeNull();
    expect(programError({ days: [{ ...data.days[0], commentsEnabled: "yes" }] })).not.toBeNull();
    expect(programError({ days: [{ ...data.days[0], polls: Array(11).fill(poll) }] })).not.toBeNull();
  });
  it("normalizes comment text but rejects author/status injection and invalid replies", () => {
    expect(parseCommentInput(comment).body).toBe("Hei!");
    for (const value of [{ ...comment, authorName: "Someone else" }, { ...comment, status: "published" }, { ...comment, parentId: -1 }, { ...comment, body: " " }, { ...comment, body: "x".repeat(2001) }, { ...comment, requestKey: "bad" }]) {
      expect(() => parseCommentInput(value)).toThrow();
    }
  });
  it("includes Program results and keeps removed-day ballots archived", () => {
    const source = { id: "program-day:day", title: "Program · Bryllupsdagen", _status: "published", polls: [poll], editorHref: "/admin/globals/program" };
    const counts = [{ postId: source.id, pollId: poll.id, optionId: "yes", count: 3, definition: poll }];
    const row = buildPollOverview([source], [source], counts)[0];
    expect(row).toMatchObject({ total: 3, editorHref: "/admin/globals/program", status: "open" });
    expect(buildPollOverview([], [], counts)[0]).toMatchObject({ total: 3, status: "archived" });
  });
});
