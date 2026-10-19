import type { CollectionConfig } from "payload";

export const Posts: CollectionConfig = {
  slug: "posts",
  labels: { singular: "Innlegg", plural: "Innlegg" },
  admin: {
    useAsTitle: "title",
    group: "Bryllupet",
    defaultColumns: ["title", "_status", "updatedAt"],
    hideAPIURL: true,
    description: "Skriv en oppdatering til gjestene. Lagre som utkast, eller publiser på forsiden.",
  },
  access: {
    read: ({ req }) => req.user ? true : { _status: { equals: "published" } },
    create: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
    delete: ({ req }) => Boolean(req.user),
  },
  versions: { drafts: true, maxPerDoc: 20 },
  hooks: {
    beforeChange: [
      ({ data, originalDoc }) => {
        if (data._status === "published" && !data.publishedAt && !originalDoc?.publishedAt) {
          data.publishedAt = new Date().toISOString();
        }
        return data;
      },
    ],
  },
  fields: [
    { name: "title", label: "Tittel", type: "text", required: true },
    // Retain the old column so existing author data isn't deleted by schema push.
    { name: "authorName", type: "text", hidden: true },
    {
      name: "theme",
      label: "Tema",
      type: "text",
      maxLength: 60,
      admin: {
        position: "sidebar",
        description: "Vises som en fremhevet etikett, for eksempel Reise, Praktisk info eller Bryllupshelgen.",
      },
    },
    {
      name: "publishedAt",
      label: "Publisert dato",
      type: "date",
      admin: {
        position: "sidebar",
        date: { pickerAppearance: "dayAndTime" },
        description: "Settes ved første publisering. For eldre innlegg kan dere velge riktig dato her.",
      },
    },
    {
      name: "description",
      label: "Beskrivelse",
      type: "textarea",
      required: true,
      admin: { description: "Hva vil dere fortelle gjestene?" },
    },
    {
      name: "photo",
      label: "Bilde (valgfritt)",
      type: "upload",
      relationTo: "media",
    },
  ],
};
