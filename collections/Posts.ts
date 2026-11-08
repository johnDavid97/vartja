import type { CollectionConfig, Where } from "payload";
import { PostImage, PostText } from "../blocks/postBlocks";
import {
  lexicalEditor, FixedToolbarFeature, HeadingFeature,
  TextStateFeature, UploadFeature, BlocksFeature,
} from "@payloadcms/richtext-lexical";
import { ArticlePhoto } from "../blocks/ArticlePhoto";
import { ArticlePoll } from "../blocks/ArticlePoll";
import { pollEndpoints } from "../lib/poll-endpoints";
import { validatePostPolls } from "../lib/validate-post-polls";
import { SidebarBlocksFeature } from "../components/admin/editor/SidebarBlocksFeature";
import { editorTextSizes } from "../lib/editor-text-sizes";
import { legacyPostToEditor } from "../lib/legacy-post-editor";

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
    read: ({ req }): boolean | Where => req.user ? true : {
      and: [
        { _status: { equals: "published" } },
        { or: [{ visibility: { equals: "public" } }, { visibility: { exists: false } }] },
      ],
    },
    create: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
    delete: ({ req }) => Boolean(req.user),
  },
  versions: { drafts: true, maxPerDoc: 20 },
  endpoints: pollEndpoints,
  hooks: {
    afterRead: [
      ({ doc }) => {
        // Preserve old records while presenting a single editor for all posts.
        if (doc.body == null) doc.body = legacyPostToEditor(doc);
        return doc;
      },
    ],
    beforeDelete: [async ({ id, req }) => {
      await req.payload.delete({ collection: "poll-votes", where: { post: { equals: id } }, overrideAccess: true, req });
    }],
    beforeChange: [
      validatePostPolls,
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
      name: "postBuilder",
      type: "ui",
      admin: {
        position: "sidebar",
        components: { Field: "/components/admin/editor/PostSidebar#PostSidebar" },
      },
    },
    {
      label: "Innstillinger",
      type: "collapsible",
      admin: { position: "sidebar", initCollapsed: false },
      fields: [
        {
          name: "visibility",
          label: "Synlighet",
          type: "select",
          defaultValue: "public",
          required: true,
          options: [
            { label: "Offentlig", value: "public" },
            { label: "Privat – bare redaktører", value: "private" },
          ],
          admin: {
            description: "Private innlegg kan kun leses av innloggede redaktører i admin. Bilder i mediebiblioteket er fortsatt offentlige. Lagre/publiser for å aktivere endringen.",
          },
        },
        {
          name: "theme",
          label: "Tema",
          type: "text",
          maxLength: 60,
          admin: { description: "Etiketten som vises på innlegget, for eksempel Reise eller Praktisk info." },
        },
        {
          name: "publishedAt",
          label: "Publisert dato",
          type: "date",
          admin: {
            date: { pickerAppearance: "dayAndTime" },
            description: "Settes ved første publisering. For eldre innlegg kan dere velge riktig dato her.",
          },
        },
        {
          name: "interactionNotice",
          type: "ui",
          admin: { components: { Field: "/components/admin/editor/PostSidebar#PostInteractionNotice" } },
        },
      ],
    },
    {
      name: "description",
      label: "Kort beskrivelse",
      type: "textarea",
      required: true,
      admin: {
        description: "En kort introduksjon som vises på innleggskortene, ikke i artikkelteksten.",
      },
    },
    {
      name: "photo",
      label: "Forsidebilde (valgfritt)",
      type: "upload",
      relationTo: "media",
      admin: {
        description: "Vises på innleggskortene. Bilder i selve artikkelen legges til i redigeringsområdet nedenfor.",
      },
    },
    {
      name: "body",
      label: "Artikkel",
      type: "richText",
      editor: lexicalEditor({
        admin: { hideAddBlockButton: true, placeholder: "Skriv her…" },
        features: ({ defaultFeatures }) => [
          // Payload reverses independent features during dependency sorting:
          // place our menu finalizer first so it resolves after all built-ins.
          SidebarBlocksFeature(),
          ...defaultFeatures.filter((feature) => ![
            "heading", "upload", "relationship", "toolbarInline", "subscript", "superscript", "inlineCode",
          ].includes(feature.key)),
          HeadingFeature({ enabledHeadingSizes: ["h2", "h3", "h4"] }),
          UploadFeature({
            enabledCollections: ["media"],
            collections: { media: { fields: [{ name: "caption", label: "Bildetekst", type: "text" }] } },
          }),
          BlocksFeature({ blocks: [ArticlePhoto, ArticlePoll] }),
          FixedToolbarFeature(),
          TextStateFeature({ state: { size: editorTextSizes } }),
        ],
      }),
      admin: {
        className: "post-visual-editor",
        description: "Skriv direkte her og bruk verktøylinjen for formatering. Dra byggeklosser fra sidepanelet inn i artikkelen, eller klikk for å sette dem inn etter valgt avsnitt. Bruk håndtaket til venstre for å flytte innhold.",
      },
    },
    {
      name: "content",
      label: "Innholdsblokker",
      type: "blocks",
      labels: { singular: "blokk", plural: "blokker" },
      blocks: [PostText, PostImage],
      maxRows: 50,
      // Retained for backwards compatibility; all editing now happens in body.
      admin: { condition: () => false },
    },
  ],
};
