import type { Post, Wedding } from "@/payload-types";
import { toHomepageSettings } from "../settings";

export interface HomepageRepository {
  readWedding(): Promise<Wedding>;
  readPublishedPosts(): Promise<Post[]>;
}

/** Only public presentation data crosses into the homepage components. */
export class LoadHomepage {
  constructor(private readonly repository: HomepageRepository) {}

  async settings() {
    return toHomepageSettings(await this.repository.readWedding());
  }

  async updates() {
    return this.repository.readPublishedPosts();
  }
}
