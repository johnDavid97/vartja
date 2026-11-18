import type { CollectionConfig, FieldAccess } from "payload";

const noFieldAccess: FieldAccess = () => false;
const protectedField = { read: noFieldAccess, create: noFieldAccess, update: noFieldAccess };

/** Durable minute buckets containing only purpose-separated HMAC digests. */
export const HouseholdLoginLimits: CollectionConfig = {
  slug: "household-login-limits",
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
      name: "bucketDigest",
      type: "text",
      required: true,
      unique: true,
      index: true,
      admin: { hidden: true },
      access: protectedField,
    },
    { name: "windowStart", type: "date", required: true, index: true, admin: { hidden: true }, access: protectedField },
    { name: "attempts", type: "number", required: true, min: 1, admin: { hidden: true }, access: protectedField },
  ],
};
