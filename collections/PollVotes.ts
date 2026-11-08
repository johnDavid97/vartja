import type { CollectionConfig } from "payload";

// Ballots are only accessed by the validated poll endpoints, never the public CRUD API.
export const PollVotes: CollectionConfig = {
  slug: "poll-votes",
  admin: { hidden: true },
  access: {
    create: () => false, read: () => false, update: () => false, delete: () => false,
  },
  fields: [
    { name: "post", type: "relationship", relationTo: "posts", required: true, index: true },
    { name: "pollId", type: "text", required: true, index: true },
    { name: "optionId", type: "text", required: true },
    { name: "definition", type: "json", required: true },
    // Hashed per-post/per-poll browser identity; uniqueness prevents concurrent duplicate votes.
    { name: "voteKey", type: "text", required: true, unique: true },
  ],
};
