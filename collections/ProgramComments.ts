import type { CollectionConfig, FieldAccess } from "payload";

const administrator = ({ req }: { req: { user?: { collection?: string } | null } }) => req.user?.collection === "users";
const noUpdate: FieldAccess = () => false;
const immutable = { access: { update: noUpdate }, admin: { readOnly: true } };

export const ProgramComments: CollectionConfig = {
  slug: "program-comments",
  labels: { singular: "Kommentar", plural: "Kommentarer" },
  admin: {
    group: "Aktivitet", useAsTitle: "body", hideAPIURL: true,
    components: { views: { list: { Component: "/components/admin/tables/AdminList#default" } } },
    defaultColumns: ["authorName", "dayLabel", "body", "status", "createdAt"],
    listSearchableFields: ["authorName", "dayLabel", "body"],
    description: "Kommentarer per programdag. Skjul eller vis kommentarer her. Svar fra brudeparet skrives på Program-siden mens du er logget inn som administrator.",
  },
  // Creation always derives authorship and scope on the server; moderation cannot rewrite a guest's words.
  access: { create: () => false, read: administrator, update: administrator, delete: () => false },
  fields: [
    { name: "dayId", label: "Dag-ID", type: "text", required: true, index: true, ...immutable },
    { name: "dayLabel", label: "Dag", type: "text", required: true, ...immutable },
    { name: "authorName", label: "Navn ved innsending", type: "text", required: true, ...immutable },
    { name: "household", label: "Husstand", type: "relationship", relationTo: "households", ...immutable },
    { name: "administrator", label: "Administrator", type: "relationship", relationTo: "users", ...immutable },
    { name: "parent", label: "Svar på", type: "relationship", relationTo: "program-comments", index: true, ...immutable },
    { name: "body", label: "Kommentar", type: "textarea", required: true, maxLength: 2000, ...immutable },
    { name: "status", label: "Synlighet", type: "select", required: true, defaultValue: "published", options: [{ label: "Synlig", value: "published" }, { label: "Skjult", value: "hidden" }] },
    { name: "requestDigest", type: "text", required: true, unique: true, access: { read: () => false, update: noUpdate }, admin: { hidden: true } },
    { name: "requestFingerprint", type: "text", required: true, access: { read: () => false, update: noUpdate }, admin: { hidden: true } },
  ],
};
