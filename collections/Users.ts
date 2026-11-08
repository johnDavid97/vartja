import type { CollectionConfig } from "payload";

// Only the couple's trusted editors have accounts. There is no public signup.
export const Users: CollectionConfig = {
  slug: "users",
  auth: true,
  labels: { singular: "Redaktør", plural: "Redaktører" },
  admin: {
    useAsTitle: "name", group: "Innstillinger", hideAPIURL: true,
    defaultColumns: ["name", "email", "updatedAt"],
    listSearchableFields: ["name", "email"],
    components: { views: { list: { Component: "/components/admin/tables/AdminList#default" } } },
  },
  access: {
    admin: ({ req }) => Boolean(req.user),
    create: ({ req }) => Boolean(req.user),
    read: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
    delete: ({ req }) => Boolean(req.user),
  },
  fields: [{ name: "name", label: "Navn", type: "text", required: true, admin: { components: { Cell: "/components/admin/tables/Cells#TitleCell" } } }],
};
