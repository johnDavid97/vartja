import type { CollectionConfig, FieldAccess } from "payload";

const noFieldAccess: FieldAccess = () => false;
const protectedField = {
  read: noFieldAccess,
  create: noFieldAccess,
  update: noFieldAccess,
};

/** Server-only opaque login sessions. Only SHA-256 token digests are persisted. */
export const HouseholdSessions: CollectionConfig = {
  slug: "household-sessions",
  admin: { hidden: true },
  versions: false,
  lockDocuments: false,
  access: {
    create: () => false,
    read: () => false,
    update: () => false,
    delete: () => false,
  },
  fields: [
    {
      name: "tokenDigest",
      type: "text",
      required: true,
      unique: true,
      index: true,
      admin: { hidden: true },
      access: protectedField,
    },
    {
      name: "household",
      type: "relationship",
      relationTo: "households",
      // Payload nulls deleted relationships. Resolution uses an inner join and rejects these sessions.
      required: false,
      index: true,
      admin: { hidden: true },
      access: protectedField,
    },
    { name: "credentialVersion", type: "number", required: true, admin: { hidden: true }, access: protectedField },
    { name: "sessionVersion", type: "number", required: true, admin: { hidden: true }, access: protectedField },
    { name: "expiresAt", type: "date", required: true, index: true, admin: { hidden: true }, access: protectedField },
  ],
};
