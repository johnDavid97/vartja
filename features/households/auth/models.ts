export type HouseholdSession = {
  householdId: number;
  displayName: string;
  status: "pending" | "approved";
};

export type LoginResult = {
  token: string;
  expiresAt: Date;
  remember: boolean;
  household: HouseholdSession;
};
