export type HouseholdStatus = "pending" | "approved" | "revoked";

export type MemberStatus = "pending" | "approved" | "revoked";

export interface HouseholdMember {
  id: string;
  name: string;
  status: MemberStatus;
}

export interface MemberInput {
  id?: string;
  name: string;
}

export interface HouseholdInput {
  contactName: string;
  email: string;
  members: MemberInput[];
}
