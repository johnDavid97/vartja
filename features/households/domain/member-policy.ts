import { HouseholdError } from "./errors";
import type { HouseholdMember, HouseholdStatus, MemberInput } from "./models";
import { validateMemberId, validateMemberInput } from "./validation";

export type MemberUpdate = HouseholdMember;

export interface MemberAddition {
  name: string;
  status: "pending";
}

/** Describes changes without saving them or allocating permanent member IDs. */
export interface MemberReconciliationPlan {
  updates: MemberUpdate[];
  additions: MemberAddition[];
  removals: string[];
}

function indexExistingMembers(existingMembers: readonly HouseholdMember[]): Map<string, HouseholdMember> {
  const existingMembersById = new Map<string, HouseholdMember>();
  for (const member of existingMembers) {
    const memberId = validateMemberId(member.id);
    if (existingMembersById.has(memberId)) {
      throw new HouseholdError("DUPLICATE_MEMBER_ID");
    }
    existingMembersById.set(memberId, member);
  }
  return existingMembersById;
}

/** Plans additions, name corrections and removals while preserving existing approval. */
export function reconcileMembers(
  existingMembers: readonly HouseholdMember[],
  submittedMembers: readonly MemberInput[],
): MemberReconciliationPlan {
  const existingMembersById = indexExistingMembers(existingMembers);
  const validatedMemberEdits = Array.from(submittedMembers, validateMemberInput);
  const retainedMemberIds = new Set<string>();
  const updates: MemberUpdate[] = [];
  const additions: MemberAddition[] = [];

  for (const memberEdit of validatedMemberEdits) {
    if (memberEdit.id === undefined) {
      additions.push({ name: memberEdit.name, status: "pending" });
      continue;
    }
    if (retainedMemberIds.has(memberEdit.id)) {
      throw new HouseholdError("DUPLICATE_MEMBER_ID");
    }

    const existingMember = existingMembersById.get(memberEdit.id);
    if (!existingMember) {
      throw new HouseholdError("UNKNOWN_MEMBER_ID");
    }
    retainedMemberIds.add(memberEdit.id);

    if (memberEdit.name !== existingMember.name) {
      updates.push({
        id: existingMember.id,
        name: memberEdit.name,
        status: existingMember.status,
      });
    }
  }

  const removals = existingMembers
    .filter((member) => !retainedMemberIds.has(member.id))
    .map((member) => member.id);

  return { updates, additions, removals };
}

export function hasApprovedHouseholdAccess(status: HouseholdStatus): boolean {
  return status === "approved";
}
