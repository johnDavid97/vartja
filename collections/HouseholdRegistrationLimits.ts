import type { CollectionConfig } from "payload";

/**
 * Schema backing the atomic SQL limiter. Payload's Postgres table is
 * `household_registration_limits`; `window_key` must retain its unique index.
 */
export const HouseholdRegistrationLimits: CollectionConfig = {
  slug: "household-registration-limits",
  admin: { hidden: true },
  versions: false,
  access: {
    create: () => false,
    read: () => false,
    update: () => false,
    delete: () => false,
  },
  fields: [
    { name: "windowKey", type: "text", required: true, unique: true, index: true },
    { name: "windowStart", type: "date", required: true, index: true },
    { name: "attempts", type: "number", required: true, min: 1 },
  ],
};
