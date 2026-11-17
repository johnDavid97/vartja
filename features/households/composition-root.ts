import { randomUUID } from "node:crypto";
import type { Payload } from "payload";
import { RevealHouseholdCode, RotateHouseholdCode } from "./application/HouseholdCodeServices";
import { RegisterHousehold } from "./application/HouseholdRegistration";
import { UpdateHouseholdDetails } from "./application/UpdateHouseholdDetails";
import type { HouseholdRepository, MemberIdGenerator } from "./application/ports";
import { HouseholdCredentialProtection, StableInvitationKey, assertHouseholdAccessSecret } from "./infrastructure/HouseholdCredentialProtection";
import { PayloadHouseholdAudit } from "./infrastructure/PayloadHouseholdAudit";
import { PayloadHouseholdRepository } from "./infrastructure/PayloadHouseholdRepository";
import { PostgresRegistrationAttemptLimiter } from "./infrastructure/PostgresRegistrationAttemptLimiter";

export interface HouseholdDependencies {
  households: HouseholdRepository;
  memberIds: MemberIdGenerator;
}

/** Existing dependency-injected foundation API; unit tests provide fakes. */
export function createHouseholdApplication(dependencies: HouseholdDependencies) {
  return {
    updateDetails: new UpdateHouseholdDetails(dependencies.households, dependencies.memberIds),
  };
}

/** The sole production construction point for registration and credential recovery. */
export function getHouseholdRegistrationServices(payload: Payload) {
  const secret = process.env.HOUSEHOLD_ACCESS_SECRET;
  assertHouseholdAccessSecret(secret);

  const clock = { now: () => new Date() };
  const identifiers = { publicId: () => randomUUID(), memberId: () => randomUUID() };
  const repository = new PayloadHouseholdRepository(payload);
  const credentials = new HouseholdCredentialProtection(secret);
  const invitation = new StableInvitationKey(secret);
  const limiter = new PostgresRegistrationAttemptLimiter(payload, clock, 100);
  const auditor = new PayloadHouseholdAudit(payload);
  const registration = new RegisterHousehold(repository, limiter, invitation, credentials, identifiers);
  const revealCode = new RevealHouseholdCode(repository, credentials, auditor, clock);
  const rotateCode = new RotateHouseholdCode(repository, credentials, clock);

  return {
    registration: { register: (input: unknown) => registration.register(input) },
    invitation: { getKey: () => invitation.getKey() },
    codes: {
      reveal: (householdId: number, administratorId: number) => revealCode.reveal(householdId, administratorId),
      rotate: (householdId: number, administratorId: number) => rotateCode.rotate(householdId, administratorId),
    },
  };
}
