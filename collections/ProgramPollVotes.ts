import type { CollectionConfig } from "payload";

/** Program ballots are household-scoped; legacy post/browser ballots remain untouched. */
export const ProgramPollVotes: CollectionConfig = {
  slug: "program-poll-votes",
  admin: { hidden: true },
  access: { create: () => false, read: () => false, update: () => false, delete: () => false },
  fields: [
    { name: "dayId", type: "text", required: true, index: true },
    { name: "pollId", type: "text", required: true, index: true },
    { name: "optionId", type: "text", required: true },
    { name: "definition", type: "json", required: true },
    { name: "voteKey", type: "text", required: true, unique: true },
  ],
};
