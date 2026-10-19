import type { CollectionConfig } from "payload";

// Only the couple's trusted editors have accounts. There is no public signup.
export const Users: CollectionConfig = {
  slug: "users",
  auth: true,
  labels: { singular: "Redaktør", plural: "Redaktører" },
  admin: { useAsTitle: "name", group: "Innstillinger", hideAPIURL: true },
  access: {
    admin: ({ req }) => Boolean(req.user),
    create: ({ req }) => Boolean(req.user),
    read: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
    delete: ({ req }) => Boolean(req.user),
  },
  fields: [{ name: "name", label: "Navn", type: "text", required: true }],
};
