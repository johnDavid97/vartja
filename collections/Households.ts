import { randomUUID } from "node:crypto";
import { ValidationError, type CollectionConfig } from "payload";
import { validateHouseholdInput, validateMemberId } from "../features/households/domain/validation";

const isAdministrator = ({ req }: { req: { user?: { collection?: string } | null } }) => req.user?.collection === "users";
const hiddenCredentialAccess = { read: () => false, create: () => false, update: () => false };
const hiddenAdmin = { hidden: true } as const;

function invalidField(path: string, message: string): never {
  throw new ValidationError({ collection: "households", errors: [{ path, message }] });
}

type MemberData = { id?: string; memberId?: string; name?: unknown; status?: unknown };
type HouseholdData = Record<string, unknown> & { members?: MemberData[]; status?: unknown };

function validatedMembers(data: HouseholdData, original: HouseholdData | undefined, trustedRegistration: boolean): MemberData[] {
  if (!Array.isArray(data.members)) invalidField("members", "Husstanden må ha medlemmer.");
  const originalMembers = Array.isArray(original?.members) ? original.members : [];
  const originalByMemberId = new Map(originalMembers.map((member) => [member.memberId, member]));
  const memberIds = new Set<string>();

  return data.members.map((submittedMember) => {
    const previousMember = submittedMember.memberId
      ? originalByMemberId.get(submittedMember.memberId)
      : undefined;
    const memberId = trustedRegistration
      ? validateMemberId(submittedMember.memberId)
      : previousMember?.memberId ?? randomUUID();
    if (memberIds.has(memberId)) invalidField("members", "Et medlem kan ikke forekomme flere ganger.");
    memberIds.add(memberId);

    // Guests only enter through trusted registration (always pending). Native
    // CRUD is admin-only, so the couple may explicitly approve a new member.
    const status = trustedRegistration ? "pending" : submittedMember.status ?? "pending";
    if (status !== "pending" && status !== "approved") invalidField("members", "Ugyldig medlemsstatus.");
    return { ...submittedMember, memberId, status };
  });
}

export const Households: CollectionConfig = {
  slug: "households",
  labels: { singular: "Husstand", plural: "Husstander" },
  admin: {
    useAsTitle: "contactName",
    group: "Brukere og admin",
    hideAPIURL: true,
    defaultColumns: ["contactName", "email", "status", "updatedAt"],
    components: {
      beforeList: ["/components/admin/households/HouseholdInvitationPanel#default"],
      views: { list: { Component: "/components/admin/tables/AdminList#default" } },
    },
  },
  versions: false,
  access: {
    admin: isAdministrator,
    create: () => false, // Native creation is intentionally disabled; registration creates safe credentials.
    read: isAdministrator,
    update: isAdministrator,
    delete: isAdministrator,
  },
  hooks: {
    beforeValidate: [({ data, originalDoc, operation, context }) => {
      if (!data) return data;
      const submitted = data as HouseholdData;
      const original = originalDoc as HouseholdData | undefined;
      const trustedRegistration = context.householdTrustedRegistration === true;


      if (operation === "create" && !trustedRegistration) invalidField("contactName", "Bruk registreringsskjemaet for å opprette en husstand.");
      if (operation === "create") {
        submitted.status = "pending";
        submitted.revision = 0;
        submitted.credentialVersion = 1;
      }
      if (operation === "update") {
        const protectedFields = [
          "publicId", "registrationRequestDigest", "registrationRequestFingerprint",
          "accessCodeDigest", "accessCodeEncrypted", "credentialVersion",
        ];
        // Payload may include defaults/previous values for hidden fields in its
        // native form submission. Never accept credential changes through CRUD;
        // the dedicated code service performs its own atomic credential update.
        for (const field of protectedFields) submitted[field] = original?.[field];
        submitted.revision = Number(original?.revision ?? 0) + 1;
      }

      const merged = { ...original, ...submitted } as HouseholdData;
      const members = validatedMembers(merged, original, trustedRegistration);
      const previousStatus = original?.status;
      const status = trustedRegistration ? "pending" : merged.status;
      if (status !== "pending" && status !== "approved" && status !== "revoked") invalidField("status", "Ugyldig husstandsstatus.");
      if (previousStatus === "pending" && status === "approved") {
        members.forEach((member) => { member.status = "approved"; });
      }

      const details = validateHouseholdInput({
        contactName: merged.contactName,
        email: merged.email,
        members: members.map(({ name }) => ({ name })),
      });
      submitted.contactName = details.contactName;
      submitted.email = details.email;
      submitted.status = status;
      submitted.members = members.map((member, index) => ({ ...member, name: details.members[index].name }));
      return submitted;
    }],
  },
  fields: [
    { name: "contactName", label: "Kontaktperson", type: "text", required: true },
    { name: "email", label: "E-post", type: "email", required: true },
    {
      name: "status", label: "Status", type: "select", required: true, defaultValue: "pending",
      options: [
        { label: "Venter", value: "pending" },
        { label: "Godkjent", value: "approved" },
        { label: "Trukket tilbake", value: "revoked" },
      ],
    },
    {
      name: "members", label: "Familiemedlemmer", type: "array", required: true, minRows: 1, maxRows: 50,
      labels: { singular: "Familiemedlem", plural: "Familiemedlemmer" },
      fields: [
        { name: "memberId", type: "text", required: true, admin: hiddenAdmin, access: { create: () => false, update: () => false } },
        { name: "name", label: "Navn", type: "text", required: true },
        {
          name: "status", label: "Godkjenning", type: "select", required: true, defaultValue: "pending",
          options: [{ label: "Venter", value: "pending" }, { label: "Godkjent", value: "approved" }],
        },
      ],
    },
    { name: "accessCodeControls", type: "ui", admin: { components: { Field: "/components/admin/households/HouseholdAccessCode#default" } } },
    { name: "revision", type: "number", required: true, defaultValue: 0, admin: hiddenAdmin, access: { create: () => false, update: () => false } },
    { name: "credentialVersion", type: "number", required: true, defaultValue: 1, admin: hiddenAdmin, access: hiddenCredentialAccess },
    { name: "publicId", type: "text", required: true, unique: true, index: true, admin: hiddenAdmin, access: hiddenCredentialAccess },
    { name: "accessCodeDigest", type: "text", required: true, unique: true, index: true, admin: hiddenAdmin, access: hiddenCredentialAccess },
    { name: "accessCodeEncrypted", type: "text", required: true, admin: hiddenAdmin, access: hiddenCredentialAccess },
    { name: "registrationRequestDigest", type: "text", required: true, unique: true, index: true, admin: hiddenAdmin, access: hiddenCredentialAccess },
    { name: "registrationRequestFingerprint", type: "text", required: true, admin: hiddenAdmin, access: hiddenCredentialAccess },
  ],
};
