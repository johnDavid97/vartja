import type { CollectionConfig } from "payload";
import { readPostsAccess } from "../features/households/auth/access";
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
import { lockGuestActivity } from "../features/guest-activity/transaction";

export const Posts: CollectionConfig = {
  slug: "posts",
  labels: { singular: "Innlegg", plural: "Innlegg" },
  admin: {
    useAsTitle: "title",
    group: "Bryllupet",
    defaultColumns: ["title", "theme", "_status", "publishedAt"],
    listSearchableFields: ["title", "theme"],
    hideAPIURL: true,
    description: "Små og store oppdateringer til gjestene deres.",
    components: {
      views: { list: { Component: "/components/admin/tables/AdminList#default" } },
      edit: { beforeDocumentControls: ["/components/admin/PostHeading#default"] },
    },
  },
  access: {
    read: readPostsAccess,
    create: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
    delete: ({ req }) => Boolean(req.user),
  },
  versions: { drafts: true, maxPerDoc: 20 },
  endpoints: pollEndpoints,
  hooks: {
    afterRead: [
      ({ doc, context }) => {
        // The article layout renders its own intro/cover. Preserve the raw legacy
        // body there so those fallback fields are not synthesized a second time.
        // Admin editing and ordinary API reads still receive the legacy adapter.
        if (doc.body == null && context.skipLegacyBodyConversion !== true) doc.body = legacyPostToEditor(doc);
        return doc;
      },
    ],
    beforeDelete: [async ({ id, req }) => {
      await lockGuestActivity(req);
      await req.payload.delete({ collection: "poll-votes", where: { post: { equals: id } }, overrideAccess: true, req });
    }],
    beforeChange: [
      async ({ data, req }) => { await lockGuestActivity(req); return data; },
      validatePostPolls,
      ({ data, originalDoc }) => {
        if (data._status === "published" && !data.publishedAt && (!originalDoc?.publishedAt || data.publishedAt === null)) {
          data.publishedAt = new Date().toISOString();
        }
        return data;
      },
    ],
  },
  fields: [
    { name: "title", label: "Tittel", type: "text", required: true, admin: { placeholder: "F.eks. Velkommen til bryllupshelgen", className: "wedding-post-title", components: { Cell: "/components/admin/tables/Cells#TitleCell" } } },
    {
      name: "_status", type: "select", label: "Status",
      // Payload merges its native draft/published options into this field.
      options: [],
      admin: { components: { Cell: "/components/admin/tables/Cells#PostStatusCell" } },
    },
    // Retain the old column so existing author data isn't deleted by schema push.
    { name: "authorName", type: "text", hidden: true },
    {
      label: "Publisering",
      type: "group",
      admin: { position: "sidebar", className: "wedding-publishing" },
      fields: [
        {
          name: "visibility",
          label: "Synlighet",
          type: "select",
          defaultValue: "public",
          required: true,
          options: [
            { label: "Godkjente gjester", value: "public" },
            { label: "Privat – bare redaktører", value: "private" },
          ],
          admin: {
            components: { Field: "/components/admin/fields/Visibility#Visibility" },
          },
        },
        {
          name: "theme",
          label: "Tema",
          type: "text",
          maxLength: 60,
          admin: { placeholder: "Skriv et tema, f.eks. Reise", description: "Etiketten som vises på innlegget." },
        },
        {
          name: "publishedAt",
          label: "Publiseringsdato",
          type: "date",
          admin: {
            components: { Field: "/components/admin/fields/PublicationDate#PublicationDate", Cell: "/components/admin/tables/Cells#PublicationCell" },
          },
        },
      ],
    },
    {
      name: "commentsEnabled", label: "Tillat kommentarer", type: "checkbox", defaultValue: true,
      admin: { position: "sidebar", components: { Description: "/components/admin/fields/PostCommentsDescription#default" } },
    },
    {
      name: "postBuilder",
      type: "ui",
      admin: {
        position: "sidebar",
        components: { Field: "/components/admin/editor/PostSidebar#PostSidebar" },
      },
    },
    {
      name: "description",
      label: "Kort beskrivelse",
      type: "textarea",
      required: true,
      admin: {
        components: { Field: "/components/admin/fields/PostDescription#PostDescription" },
      },
    },
    {
      name: "photo",
      label: "Forsidebilde (valgfritt)",
      type: "upload",
      relationTo: "media",
      admin: {
        components: { Field: "/components/admin/fields/CoverImage#CoverImage" },
      },
    },
    {
      name: "body",
      label: "Artikkel",
      type: "richText",
      editor: lexicalEditor({
        admin: { hideAddBlockButton: true, placeholder: "Begynn å skrive her …" },
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
        description: "Bruk verktøylinjen for tekst og håndtaket til venstre for å flytte innhold.",
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
