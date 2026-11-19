import type { HouseholdMember, MemberInput } from "../domain/models";
import { deriveHouseholdStatus, reconcileMembers } from "../domain/member-policy";
import { validateHouseholdInput, validateMemberId } from "../domain/validation";
import { HouseholdOperationError } from "./errors";
import type {
  HouseholdPrincipal,
  HouseholdRecord,
  HouseholdRepository,
  MemberIdGenerator,
} from "./ports";

/** Updates details and derives status from preserved member decisions; never accepts approval or credentials. */
export class UpdateHouseholdDetails {
  constructor(
    private readonly householdRepository: HouseholdRepository,
    private readonly memberIdGenerator: MemberIdGenerator,
  ) {}

  async execute(
    authenticatedHousehold: HouseholdPrincipal,
    expectedRevision: number,
    submittedDetails: unknown,
  ): Promise<HouseholdRecord> {
    const validatedDetails = validateHouseholdInput(submittedDetails);
    const currentHousehold = await this.loadEditableHousehold(
      authenticatedHousehold.householdId,
      expectedRevision,
    );
    const updatedMembers = this.buildUpdatedMembers(currentHousehold.members, validatedDetails.members);
    const updatedDetails = {
      contactName: validatedDetails.contactName,
      email: validatedDetails.email,
      members: updatedMembers,
      status: deriveHouseholdStatus(updatedMembers),
    };

    // The repository checks the revision again atomically when saving: an admin
    // may have approved a member since we loaded this household.
    const wasSaved = await this.householdRepository.updateDetails(
      currentHousehold.id,
      expectedRevision,
      updatedDetails,
    );
    if (!wasSaved) throw new HouseholdOperationError("STALE_HOUSEHOLD");

    return { ...currentHousehold, ...updatedDetails, revision: currentHousehold.revision + 1 };
  }

  private async loadEditableHousehold(
    householdId: string,
    expectedRevision: number,
  ): Promise<HouseholdRecord> {
    const household = await this.householdRepository.findById(householdId);
    if (!household) throw new HouseholdOperationError("NOT_FOUND");
    if (household.status === "revoked") throw new HouseholdOperationError("ACCESS_REVOKED");

    const isCurrentRevision = Number.isSafeInteger(expectedRevision)
      && expectedRevision >= 0
      && expectedRevision === household.revision;
    if (!isCurrentRevision) throw new HouseholdOperationError("STALE_HOUSEHOLD");

    return household;
  }

  private buildUpdatedMembers(
    existingMembers: readonly HouseholdMember[],
    submittedMembers: readonly MemberInput[],
  ): HouseholdMember[] {
    const memberChanges = reconcileMembers(existingMembers, submittedMembers);
    const removedMemberIds = new Set(memberChanges.removals);
    const memberUpdatesById = new Map(memberChanges.updates.map((member) => [member.id, member]));
    const reservedMemberIds = new Set(existingMembers.map((member) => member.id));

    const retainedMembers = existingMembers
      .filter((member) => !removedMemberIds.has(member.id))
      .map((member) => ({ ...(memberUpdatesById.get(member.id) ?? member) }));
    const newMembers = memberChanges.additions.map((member) => ({
      ...member,
      id: this.generateUniqueMemberId(reservedMemberIds),
    }));

    return [...retainedMembers, ...newMembers];
  }

  private generateUniqueMemberId(reservedMemberIds: Set<string>): string {
    let memberId: string;
    try {
      memberId = validateMemberId(this.memberIdGenerator.next());
    } catch {
      throw new HouseholdOperationError("IDENTIFIER_FAILURE");
    }

    // Never reuse even a removed member's ID: it represents a different person.
    if (reservedMemberIds.has(memberId)) throw new HouseholdOperationError("IDENTIFIER_FAILURE");
    reservedMemberIds.add(memberId);
    return memberId;
  }
}
