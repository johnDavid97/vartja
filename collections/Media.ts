import path from "node:path";
import type { CollectionConfig } from "payload";
import { readMediaAccess } from "../features/households/auth/access";

export const Media: CollectionConfig = {
  slug: "media",
  labels: { singular: "Bilde", plural: "Bilder" },
  admin: {
    group: "Bryllupet",
    useAsTitle: "alt",
    defaultColumns: ["filename", "alt", "updatedAt"],
    listSearchableFields: ["filename", "alt"],
    components: { views: { list: { Component: "/components/admin/tables/AdminList#default" } } },
    hideAPIURL: true,
    description: "Bilder deles med godkjente gjester. Det valgte forsidebildet er offentlig. Ikke last opp fortrolige dokumenter.",
  },
  access: {
    read: readMediaAccess,
    create: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
    delete: ({ req }) => Boolean(req.user),
  },
  upload: {
    staticDir: path.resolve(process.cwd(), "media"),
    modifyResponseHeaders: ({ headers }) => {
      headers.set("Cache-Control", "private, no-store");
      headers.set("Vary", "Cookie");
      headers.set("X-Content-Type-Options", "nosniff");
      return headers;
    },
    mimeTypes: ["image/jpeg", "image/png", "image/webp"],
  },
  fields: [
    {
      name: "alt",
      label: "Beskriv bildet",
      type: "text",
      required: true,
      admin: { description: "En kort beskrivelse for gjester som bruker skjermleser." },
    },
  ],
};
