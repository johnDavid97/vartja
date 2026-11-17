export type HouseholdErrorCode =
  | "INVALID_INPUT"
  | "UNKNOWN_FIELD"
  | "INVALID_NAME"
  | "INVALID_EMAIL"
  | "INVALID_MEMBERS"
  | "TOO_MANY_MEMBERS"
  | "INVALID_MEMBER_ID"
  | "DUPLICATE_MEMBER_ID"
  | "UNKNOWN_MEMBER_ID";

const publicMessages: Record<HouseholdErrorCode, string> = {
  INVALID_INPUT: "The household details are invalid.",
  UNKNOWN_FIELD: "The household details contain an unsupported field.",
  INVALID_NAME: "A name is invalid.",
  INVALID_EMAIL: "The email address is invalid.",
  INVALID_MEMBERS: "The household must contain at least one member.",
  TOO_MANY_MEMBERS: "The household contains too many members.",
  INVALID_MEMBER_ID: "A member identifier is invalid.",
  DUPLICATE_MEMBER_ID: "A member identifier was supplied more than once.",
  UNKNOWN_MEMBER_ID: "A member does not belong to this household.",
};

export class HouseholdError extends Error {
  readonly code: HouseholdErrorCode;

  constructor(code: HouseholdErrorCode) {
    super(publicMessages[code]);
    this.name = "HouseholdError";
    this.code = code;
  }
}
