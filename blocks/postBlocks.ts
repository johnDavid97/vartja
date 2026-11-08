import type { Block } from "payload";

export const PostText: Block = {
  slug: "text",
  interfaceName: "PostTextBlock",
  labels: { singular: "Tekst", plural: "Tekster" },
  fields: [
    { name: "heading", label: "Overskrift (valgfritt)", type: "text" },
    {
      name: "text",
      label: "Tekst",
      type: "textarea",
      required: true,
      admin: { description: "Bruk en tom linje mellom avsnitt." },
    },
  ],
};

export const PostImage: Block = {
  slug: "image",
  interfaceName: "PostImageBlock",
  labels: { singular: "Bilde", plural: "Bilder" },
  fields: [
    { name: "image", label: "Bilde", type: "upload", relationTo: "media", required: true },
    { name: "caption", label: "Bildetekst (valgfritt)", type: "text" },
  ],
};
