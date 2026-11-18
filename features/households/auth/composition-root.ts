import type { Payload } from "payload";
import { HouseholdCredentialProtection, assertHouseholdAccessSecret } from "../infrastructure/HouseholdCredentialProtection";
import { HouseholdAuthService } from "./HouseholdAuthService";
import {
  PostgresHouseholdSessionRepository,
  PostgresLoginAttemptLimiter,
  SecureSessionTokens,
} from "./infrastructure";
import type { HouseholdSession } from "./models";

export type { HouseholdSession } from "./models";
export { AuthError } from "./errors";

/** Sole production composition root for household login sessions. */
export function getHouseholdAuthServices(payload: Payload): {
  login(input: unknown): Promise<{
    token: string;
    expiresAt: Date;
    remember: boolean;
    household: HouseholdSession;
  }>;
  resolve(token: string | null): Promise<HouseholdSession | null>;
  logout(token: string | null): Promise<void>;
} {
  const secret = process.env.HOUSEHOLD_ACCESS_SECRET;
  assertHouseholdAccessSecret(secret);
  const clock = { now: () => new Date() };
  const auth = new HouseholdAuthService(
    new PostgresHouseholdSessionRepository(payload),
    new PostgresLoginAttemptLimiter(payload, secret, clock),
    new HouseholdCredentialProtection(secret),
    clock,
    new SecureSessionTokens(),
  );

  return {
    login: (input) => auth.login(input),
    resolve: (token) => auth.resolve(token),
    logout: (token) => auth.logout(token),
  };
}
