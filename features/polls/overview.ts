import { getPolls, parsePoll, type PollDefinition } from "@/lib/polls";

export type PollPost = { id: number; title: string; body?: unknown; _status?: string | null; visibility?: string | null };
export type PollVoteCount = { postId: number; pollId: string; optionId: string; count: number; definition: unknown };
export type PollOverviewRow = {
  key: string; postId: number; postTitle: string; pollId: string; question: string;
  status: "open" | "closed" | "draft" | "archived";
  private: boolean; hasDraftChanges: boolean; total: number;
  options: { id: string; label: string; count: number }[];
};
export interface PollOverviewRepository {
  readPosts(): Promise<{ saved: PollPost[]; drafts: PollPost[] }>;
  readVoteCounts(): Promise<PollVoteCount[]>;
}

const keyFor = (postId: number, pollId: string) => JSON.stringify([postId, pollId]);

/** Published definitions stay authoritative; drafts never masquerade as live voting settings. */
export function buildPollOverview(saved: PollPost[], drafts: PollPost[], counts: PollVoteCount[]): PollOverviewRow[] {
  const rows = new Map<string, PollOverviewRow>();
  const draftPosts = new Map(drafts.map((post) => [post.id, post]));
  const posts = new Map([...saved, ...drafts].map((post) => [post.id, post]));
  function add(post: PollPost, poll: PollDefinition, status: PollOverviewRow["status"], hasDraftChanges = false) {
    const key = keyFor(post.id, poll.id);
    if (rows.has(key)) return;
    rows.set(key, { key, postId: post.id, postTitle: post.title, pollId: poll.id, question: poll.question, status,
      private: post.visibility === "private", hasDraftChanges, total: 0,
      options: poll.options.map((option) => ({ ...option, count: 0 })) });
  }
  for (const post of saved) {
    if (post._status !== "published") continue;
    const latest = draftPosts.get(post.id);
    const latestPolls = latest ? getPolls(latest.body) : getPolls(post.body);
    for (const poll of getPolls(post.body)) {
      const draftPoll = latestPolls.find((candidate) => candidate.id === poll.id);
      add(post, poll, poll.open ? "open" : "closed", JSON.stringify(draftPoll) !== JSON.stringify(poll));
    }
  }
  for (const post of drafts) for (const poll of getPolls(post.body)) add(post, poll, "draft");
  // A removed poll can still have ballots. Preserve their results using the stored definition.
  for (const count of counts) {
    const key = keyFor(count.postId, count.pollId);
    if (!rows.has(key)) {
      const post = posts.get(count.postId);
      const definition = parsePoll(count.definition);
      if (post && definition) add(post, { ...definition, id: count.pollId }, "archived");
    }
    const row = rows.get(key);
    if (!row) continue;
    const option = row.options.find((candidate) => candidate.id === count.optionId);
    if (option) option.count += count.count;
    else row.options.push({ id: count.optionId, label: "Tidligere svaralternativ", count: count.count });
    row.total += count.count;
  }
  return [...rows.values()].sort((a, b) => a.postTitle.localeCompare(b.postTitle, "nb") || a.question.localeCompare(b.question, "nb") || a.key.localeCompare(b.key));
}

export class LoadPollOverview {
  constructor(private readonly repository: PollOverviewRepository) {}
  async execute(): Promise<PollOverviewRow[]> {
    const [posts, counts] = await Promise.all([this.repository.readPosts(), this.repository.readVoteCounts()]);
    return buildPollOverview(posts.saved, posts.drafts, counts);
  }
}
