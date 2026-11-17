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

export interface HouseholdRepository {
  findById(householdId: string): Promise<HouseholdRecord | null>;
  /**
   * Atomically compare revision, update only contact/members and increment revision.
   * Return false if deleted or changed since read. Every admin/guest mutation must
   * advance revision, so concurrent approval cannot be overwritten by a guest edit.
   */
  updateDetails(householdId: string, expectedRevision: number, updatedDetails: HouseholdDetails): Promise<boolean>;
}

export interface MemberIdGenerator {
  next(): string;
}

/** Construct only from a validated server session, never from submitted JSON. */
export interface HouseholdPrincipal {
  householdId: string;
}
