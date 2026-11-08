import path from "node:path";
import type { CollectionConfig } from "payload";

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
    description: "Bilder til nettsiden. Opplastede bilder er offentlige – ikke last opp private dokumenter.",
  },
  access: {
    read: () => true,
    create: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
    delete: ({ req }) => Boolean(req.user),
  },
  upload: {
    staticDir: path.resolve(process.cwd(), "media"),
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
