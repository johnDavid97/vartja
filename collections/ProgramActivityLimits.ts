import type { CollectionConfig } from "payload";

export const ProgramActivityLimits: CollectionConfig = {
  slug: "program-activity-limits", admin: { hidden: true },
  access: { create: () => false, read: () => false, update: () => false, delete: () => false },
  fields: [
    { name: "bucketDigest", type: "text", required: true, unique: true },
    { name: "windowStart", type: "date", required: true, index: true },
    { name: "attempts", type: "number", required: true },
  ],
};
