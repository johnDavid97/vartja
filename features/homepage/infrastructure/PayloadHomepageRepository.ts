import type { Payload } from "payload";
import type { HomepageRepository } from "../application/LoadHomepage";

export class PayloadHomepageRepository implements HomepageRepository {
  constructor(private readonly payload: Payload) {}

  async readWedding() {
    return this.payload.findGlobal({ slug: "wedding", overrideAccess: false, depth: 1 });
  }

  async readPublishedPosts() {
    const posts = await this.payload.find({
      collection: "posts", overrideAccess: false, draft: false,
      sort: "-publishedAt", limit: 12, depth: 1,
      // Explicit even if a later adapter accidentally forwards an admin identity.
      where: { and: [
        { _status: { equals: "published" } },
        { or: [{ visibility: { equals: "public" } }, { visibility: { exists: false } }] },
      ] },
    });
    return posts.docs;
  }
}
