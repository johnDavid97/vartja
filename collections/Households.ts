import { randomUUID } from "node:crypto";
import { lockHouseholdUpdates } from "../features/households/infrastructure/lockHouseholdUpdates";
import { ValidationError, type CollectionConfig } from "payload";
import { normalizeHouseholdName } from "../features/households/domain/household-name";
import { deriveHouseholdStatus } from "../features/households/domain/member-policy";
import type { MemberStatus } from "../features/households/domain/models";
import { validateHouseholdInput, validateMemberId } from "../features/households/domain/validation";

const isAdministrator = ({ req }: { req: { user?: { collection?: string } | null } }) => req.user?.collection === "users";
const hiddenCredentialAccess = { read: () => false, create: () => false, update: () => false };
const hiddenAdmin = { hidden: true } as const;

function invalidField(path: string, message: string): never {
  throw new ValidationError({ collection: "households", errors: [{ path, message }] });
}

type MemberData = { id?: string; memberId?: string; name?: unknown; status?: unknown };
type ValidatedMemberData = Omit<MemberData, "status"> & { status: MemberStatus };
type HouseholdData = Record<string, unknown> & { displayName?: unknown; members?: MemberData[]; status?: unknown };

// Payload may initialize from an RSC bundle before a REST bundle calls this factory.
// Share an opaque object across bundles, not a Symbol.for value as the capability itself:
// clients can serialize global symbols through Flight, but cannot recreate this object identity.
const trustedAdminCreationKey = Symbol.for("vartja.households.trusted-admin-creation");
type CreationToken = Readonly<{ purpose: "household-admin-creation" }>;
const creationRegistry = globalThis as typeof globalThis & { [trustedAdminCreationKey]?: CreationToken };
const trustedAdminCreationToken = creationRegistry[trustedAdminCreationKey]
  ??= Object.freeze({ purpose: "household-admin-creation" as const });

/** An identity token (not JSON data) makes this creation path available only to server code. */
export function trustedAdminHouseholdCreationContext(): Record<string, unknown> {
  return { householdTrustedAdminCreation: trustedAdminCreationToken };
}

function validatedMembers(
  data: HouseholdData,
  original: HouseholdData | undefined,
  creationMode: "registration" | "administrator" | null,
): ValidatedMemberData[] {
  if (!Array.isArray(data.members)) invalidField("members", "Husstanden må ha medlemmer.");
  const originalMembers = Array.isArray(original?.members) ? original.members : [];
  const originalByMemberId = new Map(originalMembers.map((member) => [member.memberId, member]));
  const memberIds = new Set<string>();

  return data.members.map((submittedMember) => {
    const previousMember = submittedMember.memberId
      ? originalByMemberId.get(submittedMember.memberId)
      : undefined;
    const memberId = creationMode
      ? validateMemberId(submittedMember.memberId)
      : previousMember?.memberId ?? randomUUID();
    if (memberIds.has(memberId)) invalidField("members", "Et medlem kan ikke forekomme flere ganger.");
    memberIds.add(memberId);

    // Guest registration is always pending; the separate trusted administrator
    // creation path is approved. Native CRUD may decide each new member's status.
    const status = creationMode === "registration"
      ? "pending"
      : creationMode === "administrator" ? "approved" : submittedMember.status ?? "pending";
    if (status !== "pending" && status !== "approved" && status !== "revoked") invalidField("members", "Ugyldig medlemsstatus.");
    return { ...submittedMember, memberId, status };
  });
}

export const Households: CollectionConfig = {
  slug: "households",
  labels: { singular: "Husstand", plural: "Husstander" },
  admin: {
    useAsTitle: "displayName",
    group: "Brukere og admin",
    hideAPIURL: true,
    defaultColumns: ["displayName", "contactName", "members", "status", "updatedAt"],
    listSearchableFields: ["displayName", "contactName", "email"],
    components: {
      views: { list: { Component: "/components/admin/households/HouseholdWorkspace#default" } },
      edit: { beforeDocumentControls: ["/components/admin/households/HouseholdHeading#default"] },
    },
  },
  forceSelect: { displayName: true, contactName: true, email: true, members: true },
  versions: false,
  access: {
    admin: isAdministrator,
    create: () => false, // Only dedicated registration/admin services may create credentials and initial members.
    read: isAdministrator,
    update: isAdministrator,
    delete: isAdministrator,
  },
  hooks: {
    beforeOperation: [lockHouseholdUpdates],
    beforeValidate: [({ data, originalDoc, operation, context }) => {
      if (!data) return data;
      const submitted = data as HouseholdData;
      const original = originalDoc as HouseholdData | undefined;
      const trustedRegistration = context.householdTrustedRegistration === true;
      const trustedAdminCreation = context.householdTrustedAdminCreation === trustedAdminCreationToken;
      const creationMode = trustedRegistration
        ? "registration" as const
        : trustedAdminCreation ? "administrator" as const : null;

      if (operation === "create" && !creationMode) invalidField("contactName", "Bruk registreringsskjemaet for å opprette en husstand.");
      if (operation === "create") {
        submitted.status = creationMode === "administrator" ? "approved" : "pending";
        submitted.revision = 0;
        submitted.credentialVersion = 1;
        submitted.sessionVersion = 1;
      }
      if (operation === "update") {
        const protectedFields = [
          "publicId", "registrationRequestDigest", "registrationRequestFingerprint",
          "accessCodeDigest", "accessCodeEncrypted", "credentialVersion", "sessionVersion",
        ];
        // Payload may include defaults/previous values for hidden fields in its
        // native form submission. Never accept credential changes through CRUD;
        // the dedicated code service performs its own atomic credential update.
        for (const field of protectedFields) submitted[field] = original?.[field];
        submitted.revision = Number(original?.revision ?? 0) + 1;
      }

      const merged = { ...original, ...submitted } as HouseholdData;
      const members = validatedMembers(merged, original, creationMode);
      const previousStatus = original?.status;
      const details = validateHouseholdInput({
        contactName: merged.contactName,
        email: merged.email,
        members: members.map(({ name }) => ({ name })),
      });
      submitted.contactName = details.contactName;
      try {
        submitted.displayName = normalizeHouseholdName(
          operation === "create" && merged.displayName === undefined ? details.contactName : merged.displayName,
        );
      } catch {
        invalidField("displayName", "Husstandsnavnet er ugyldig.");
      }
      const normalizedMembers = members.map((member, index) => ({
        ...member,
        name: details.members[index].name,
      }));
      const status = deriveHouseholdStatus(normalizedMembers);
      if (operation === "update") {
        const previousSessionVersion = Number(original?.sessionVersion ?? 1);
        const revokesSessions = (previousStatus === "approved" && status !== "approved")
          || (previousStatus !== "revoked" && status === "revoked");
        submitted.sessionVersion = previousSessionVersion + (revokesSessions ? 1 : 0);
      }
      submitted.email = details.email;
      submitted.status = status;
      submitted.members = normalizedMembers;
      return submitted;
    }],
  },
  fields: [
    {
      type: "group", label: "Kontaktopplysninger",
      admin: { className: "household-contact" },
      fields: [
        {
          name: "displayName", label: "Husstandsnavn", type: "text", required: true, maxLength: 120,
          admin: { description: "Navnet husstanden bruker ved innlogging og kommentarer." },
        },
        {
          name: "contactName", label: "Kontaktperson", type: "text", required: true,
          admin: { components: { Cell: "/components/admin/households/HouseholdCells#HouseholdContactCell" } },
        },
        { name: "email", label: "E-post", type: "email", required: true },
      ],
    },
    {
      name: "status", label: "Status", type: "select", required: true, defaultValue: "pending",
      admin: { position: "sidebar", components: {
        Cell: "/components/admin/households/HouseholdCells#HouseholdStatusCell",
        Field: "/components/admin/households/HouseholdApprovalField#default",
      } },
      options: [
        { label: "Venter", value: "pending" },
        { label: "Godkjent", value: "approved" },
        { label: "Avslått", value: "revoked" },
      ],
    },
    {
      name: "members", label: "Familiemedlemmer", type: "array", required: true, minRows: 1, maxRows: 50,
      labels: { singular: "Familiemedlem", plural: "Familiemedlemmer" },
      admin: {
        className: "household-members", isSortable: false,
        components: {
          Cell: "/components/admin/households/HouseholdCells#HouseholdMembersCell",
          Field: "/components/admin/households/HouseholdMembersField#default",
        },
      },
      fields: [
        { name: "memberId", type: "text", required: true, admin: hiddenAdmin, access: { create: () => false, update: () => false } },
        { name: "name", label: "Navn", type: "text", required: true },
        {
          name: "status", label: "Godkjenning", type: "select", required: true, defaultValue: "pending",
          options: [
            { label: "Venter", value: "pending" },
            { label: "Godkjent", value: "approved" },
            { label: "Avslått", value: "revoked" },
          ],
          admin: { components: { Field: "/components/admin/households/HouseholdMemberStatusField#default" } },
        },
      ],
    },
    {
      name: "updatedAt", label: "Sist endret", type: "date", index: true,
      admin: {
        hidden: true, disableBulkEdit: true,
        components: { Cell: "/components/admin/households/HouseholdCells#HouseholdDateCell" },
      },
    },
    { name: "accessCodeControls", type: "ui", admin: { position: "sidebar", components: { Field: "/components/admin/households/HouseholdAccessCode#default" } } },
    { name: "revision", type: "number", required: true, defaultValue: 0, admin: hiddenAdmin, access: { create: () => false, update: () => false } },
    { name: "credentialVersion", type: "number", required: true, defaultValue: 1, admin: hiddenAdmin, access: hiddenCredentialAccess },
    { name: "sessionVersion", type: "number", required: true, defaultValue: 1, admin: hiddenAdmin, access: hiddenCredentialAccess },
    { name: "publicId", type: "text", required: true, unique: true, index: true, admin: hiddenAdmin, access: hiddenCredentialAccess },
    { name: "accessCodeDigest", type: "text", required: true, unique: true, index: true, admin: hiddenAdmin, access: hiddenCredentialAccess },
    { name: "accessCodeEncrypted", type: "text", required: true, admin: hiddenAdmin, access: hiddenCredentialAccess },
    { name: "registrationRequestDigest", type: "text", required: true, unique: true, index: true, admin: hiddenAdmin, access: hiddenCredentialAccess },
    { name: "registrationRequestFingerprint", type: "text", required: true, admin: hiddenAdmin, access: hiddenCredentialAccess },
  ],
};
