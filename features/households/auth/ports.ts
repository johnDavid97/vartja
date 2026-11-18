import type { HouseholdSession } from "./models";

export interface Clock {
  now(): Date;
}

export interface TokenSource {
  generate(): string;
  digest(token: string): string;
}

export interface CredentialLookup {
  lookupDigest(canonicalCode: string): string;
}

export type LoginHouseholdSnapshot = HouseholdSession & {
  credentialDigest: string;
  credentialVersion: number;
  sessionVersion: number;
};

export interface HouseholdSessionRepository {
  findByCredentialDigest(digest: string): Promise<LoginHouseholdSnapshot | null>;
  createIfUnchanged(input: {
    household: LoginHouseholdSnapshot;
    tokenDigest: string;
    expiresAt: Date;
    now: Date;
  }): Promise<HouseholdSession | null>;
  resolve(tokenDigest: string, now: Date): Promise<HouseholdSession | null>;
  delete(tokenDigest: string): Promise<void>;
  cleanup(now: Date, limit: number): Promise<void>;
}

export interface LoginAttemptLimiter {
  /** Consumes both the global and normalized-name minute buckets atomically. */
  consume(normalizedName: string): Promise<boolean>;
}
