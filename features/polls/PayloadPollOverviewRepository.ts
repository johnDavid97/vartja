import { sql } from "@payloadcms/db-postgres";
import type { PayloadRequest } from "payload";
import type { PollOverviewRepository, PollPost, PollVoteCount } from "./overview";

/** Admin-only adapter. Aggregate ballots without loading or returning voter identifiers. */
export class PayloadPollOverviewRepository implements PollOverviewRepository {
  constructor(private readonly req: PayloadRequest) {
    if (req.user?.collection !== "users") throw new Error("Administrator required");
  }

  private async posts(draft: boolean): Promise<PollPost[]> {
    const posts: PollPost[] = [];
    let page = 1;
    let hasNextPage = true;
    while (hasNextPage) {
      const result = await this.req.payload.find({
        collection: "posts", req: this.req, overrideAccess: false, draft, depth: 0,
        page, limit: 100, sort: "id",
        select: { title: true, body: true, _status: true, visibility: true },
      });
      posts.push(...result.docs);
      hasNextPage = result.hasNextPage;
      page += 1;
    }
    return posts;
  }

  async readPosts() {
    const [saved, drafts] = await Promise.all([this.posts(false), this.posts(true)]);
    return { saved, drafts };
  }

  async readVoteCounts(): Promise<PollVoteCount[]> {
    const result = await this.req.payload.db.drizzle.execute(sql`
      SELECT post_id, poll_id, option_id, count(*) AS count,
             min(definition::text)::jsonb AS definition
      FROM poll_votes GROUP BY post_id, poll_id, option_id
    `);
    return result.rows.map((row) => ({ postId: Number(row.post_id), pollId: String(row.poll_id),
      optionId: String(row.option_id), count: Number(row.count), definition: row.definition }));
  }
}
