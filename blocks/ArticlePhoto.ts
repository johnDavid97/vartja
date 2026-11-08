import type { Block } from "payload";

export const ArticlePhoto: Block = {
  slug: "photo",
  interfaceName: "ArticlePhotoBlock",
  labels: { singular: "Bilde", plural: "Bilder" },
  admin: {
    components: { Block: "/components/admin/editor/PhotoBlock#PhotoBlock" },
  },
  fields: [
    { name: "image", label: "Bilde", type: "upload", relationTo: "media", required: true },
    { name: "alt", label: "Beskrivelse for skjermleser", type: "text" },
    { name: "caption", label: "Bildetekst", type: "text" },
  ],
};
