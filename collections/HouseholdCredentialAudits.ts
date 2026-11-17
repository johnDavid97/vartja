import type { CollectionConfig } from "payload";

const isAdministrator = ({ req }: { req: { user?: { collection?: string } | null } }) => req.user?.collection === "users";

/** Append-only credential access audit. It never stores codes, digests or ciphertext. */
export const HouseholdCredentialAudits: CollectionConfig = {
  slug: "household-credential-audits",
  admin: { hidden: true },
  versions: false,
  access: {
    create: () => false,
    read: isAdministrator,
    update: () => false,
    delete: () => false,
  },
  fields: [
    { name: "household", type: "number", required: true, index: true },
    { name: "administrator", type: "number", required: true, index: true },
    {
      name: "action", type: "select", required: true,
      options: [{ label: "Viste kode", value: "reveal" }, { label: "Byttet kode", value: "rotate" }],
    },
    { name: "occurredAt", type: "date", required: true, index: true },
  ],
};
