import { validateMemberId } from "../domain/validation";
import { householdRequestKeyPattern } from "../domain/initial-household";
import type {
  HouseholdCredentialService,
  ProtectedHouseholdCode,
  RegistrationIdentifierSource,
} from "./HouseholdRegistration";

export interface ProvisionedInitialHousehold<Status extends "pending" | "approved"> {
  publicId: string;
  accessCode: string;
  code: ProtectedHouseholdCode;
  members: { memberId: string; name: string; status: Status }[];
}

/** Allocate all identifiers and credential material before a single persistence operation. */
export function provisionInitialHousehold<Status extends "pending" | "approved">(
  memberNames: string[],
  status: Status,
  credentials: HouseholdCredentialService,
  identifiers: RegistrationIdentifierSource,
): ProvisionedInitialHousehold<Status> {
  const publicId = identifiers.publicId();
  if (!householdRequestKeyPattern.test(publicId)) throw new Error("Invalid public identifier");
  const accessCode = credentials.generateCode();
  const code = credentials.protectCode(accessCode, publicId);
  const allocatedMemberIds = new Set<string>();
  const members = memberNames.map((name) => {
    const memberId = validateMemberId(identifiers.memberId());
    if (allocatedMemberIds.has(memberId)) throw new Error("Duplicate member identifier");
    allocatedMemberIds.add(memberId);
    return { memberId, name, status };
  });
  return { publicId, accessCode, code, members };
}
