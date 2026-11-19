import type { HouseholdMember, HouseholdStatus } from "../domain/models";

/** Internal persistence model. Credentials and session tokens deliberately live elsewhere. */
export interface HouseholdRecord extends HouseholdDetails {
  id: string;
  status: HouseholdStatus;
  /** Change counter used to detect a form that was loaded before another edit. */
  revision: number;
}

export interface HouseholdDetails {
  contactName: string;
  email: string;
  members: HouseholdMember[];
}

export interface HouseholdDetailsUpdate extends HouseholdDetails {
  status: HouseholdStatus;
}

export interface HouseholdRepository {
  findById(householdId: string): Promise<HouseholdRecord | null>;
  /**
   * Atomically compare revision, update contact/members/materialized status and
   * increment revision. The implementation must also increment the persisted
   * session version when approved access is lost or a non-revoked household becomes
   * revoked. Return false if deleted or changed since read. Every admin/guest
   * mutation must advance revision so concurrent member decisions are not overwritten.
   */
  updateDetails(householdId: string, expectedRevision: number, updatedDetails: HouseholdDetailsUpdate): Promise<boolean>;
}

export interface MemberIdGenerator {
  next(): string;
}

/** Construct only from a validated server session, never from submitted JSON. */
export interface HouseholdPrincipal {
  householdId: string;
}
