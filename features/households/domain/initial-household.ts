import { HouseholdError } from "./errors";
import { normalizeHouseholdName } from "./household-name";
import { MAX_MEMBERS, validateHouseholdInput } from "./validation";

export interface ValidatedInitialHousehold {
  requestKey: string;
  contactName: string;
  displayName?: string;
  email: string;
  memberNames: string[];
}

const requiredInitialHouseholdFields = ["requestKey", "contactName", "email", "additionalMembers"] as const;
const initialHouseholdFields = [...requiredInitialHouseholdFields, "displayName"] as const;
export const householdRequestKeyPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Validate and normalize the common initial-household shape used by guest and admin creation. */
export function validateInitialHousehold(value: unknown): ValidatedInitialHousehold {
  if (!isRecord(value)) throw new HouseholdError("INVALID_INPUT");
  const fields = Object.keys(value);
  if ((fields.length !== requiredInitialHouseholdFields.length && fields.length !== initialHouseholdFields.length)
    || fields.some((field) => !(initialHouseholdFields as readonly string[]).includes(field))
    || requiredInitialHouseholdFields.some((field) => !Object.hasOwn(value, field))) {
    throw new HouseholdError("INVALID_INPUT");
  }
  if (typeof value.requestKey !== "string" || !householdRequestKeyPattern.test(value.requestKey)) {
    throw new HouseholdError("INVALID_INPUT");
  }
  if (!Array.isArray(value.additionalMembers) || value.additionalMembers.length >= MAX_MEMBERS) {
    throw new HouseholdError("INVALID_INPUT");
  }
  if (value.additionalMembers.some((member) =>
    !isRecord(member) || Object.keys(member).length !== 1 || !Object.hasOwn(member, "name")
  )) {
    throw new HouseholdError("INVALID_INPUT");
  }

  // The contact is always the first member and is added in exactly one place.
  const details = validateHouseholdInput({
    contactName: value.contactName,
    email: value.email,
    members: [{ name: value.contactName }, ...value.additionalMembers],
  });
  const displayName = Object.hasOwn(value, "displayName")
    ? normalizeHouseholdName(value.displayName)
    : undefined;
  return {
    requestKey: value.requestKey.toLowerCase(),
    contactName: details.contactName,
    ...(displayName === undefined ? {} : { displayName }),
    email: details.email,
    memberNames: details.members.map(({ name }) => name),
  };
}
