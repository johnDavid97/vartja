import { HouseholdError } from "./errors";
import type { HouseholdInput, MemberInput } from "./models";

export const MAX_MEMBERS = 50;
export const MAX_NAME_LENGTH = 100;
export const MAX_EMAIL_LENGTH = 254;
export const MAX_MEMBER_ID_LENGTH = 128;

const memberIdPattern = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const controlCharacterPattern = /[\u0000-\u001f\u007f]/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertExpectedFields(
  submittedFields: Record<string, unknown>,
  requiredFieldNames: readonly string[],
  optionalFieldNames: readonly string[] = [],
): void {
  const allowedFieldNames = new Set([...requiredFieldNames, ...optionalFieldNames]);
  if (Object.keys(submittedFields).some((fieldName) => !allowedFieldNames.has(fieldName))) {
    throw new HouseholdError("UNKNOWN_FIELD");
  }
  if (requiredFieldNames.some((fieldName) => !Object.hasOwn(submittedFields, fieldName))) {
    throw new HouseholdError("INVALID_INPUT");
  }
}

function validateName(value: unknown): string {
  if (typeof value !== "string") {
    throw new HouseholdError("INVALID_NAME");
  }

  const name = value.trim();
  if (name.length === 0 || name.length > MAX_NAME_LENGTH || controlCharacterPattern.test(name)) {
    throw new HouseholdError("INVALID_NAME");
  }
  return name;
}

export function validateMemberId(value: unknown): string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > MAX_MEMBER_ID_LENGTH ||
    !memberIdPattern.test(value)
  ) {
    throw new HouseholdError("INVALID_MEMBER_ID");
  }
  return value;
}

function validateEmail(value: unknown): string {
  if (typeof value !== "string") {
    throw new HouseholdError("INVALID_EMAIL");
  }

  const email = value.trim().toLowerCase();
  if (
    email.length === 0 ||
    email.length > MAX_EMAIL_LENGTH ||
    controlCharacterPattern.test(email) ||
    !emailPattern.test(email)
  ) {
    throw new HouseholdError("INVALID_EMAIL");
  }
  return email;
}

export function validateMemberInput(value: unknown): MemberInput {
  if (!isRecord(value)) {
    throw new HouseholdError("INVALID_INPUT");
  }
  assertExpectedFields(value, ["name"], ["id"]);

  const member: MemberInput = { name: validateName(value.name) };
  if (Object.hasOwn(value, "id")) {
    member.id = validateMemberId(value.id);
  }
  return member;
}

function validateMemberList(submittedMembers: unknown): MemberInput[] {
  if (!Array.isArray(submittedMembers) || submittedMembers.length === 0) {
    throw new HouseholdError("INVALID_MEMBERS");
  }
  if (submittedMembers.length > MAX_MEMBERS) {
    throw new HouseholdError("TOO_MANY_MEMBERS");
  }

  const validatedMembers = Array.from(submittedMembers, validateMemberInput);
  const seenMemberIds = new Set<string>();
  for (const member of validatedMembers) {
    if (member.id === undefined) continue;
    if (seenMemberIds.has(member.id)) {
      throw new HouseholdError("DUPLICATE_MEMBER_ID");
    }
    seenMemberIds.add(member.id);
  }
  return validatedMembers;
}

export function validateHouseholdInput(value: unknown): HouseholdInput {
  if (!isRecord(value)) {
    throw new HouseholdError("INVALID_INPUT");
  }
  assertExpectedFields(value, ["contactName", "email", "members"]);

  // Validate members first to keep the existing error priority for invalid forms.
  const members = validateMemberList(value.members);
  return {
    contactName: validateName(value.contactName),
    email: validateEmail(value.email),
    members,
  };
}
