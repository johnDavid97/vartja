import { AuthError } from "./errors";
import type { LoginResult } from "./models";
import type {
  Clock,
  CredentialLookup,
  HouseholdSessionRepository,
  LoginAttemptLimiter,
  TokenSource,
} from "./ports";
import {
  comparableHouseholdName,
  limiterNameMaterial,
  validateLoginInput,
} from "./validation";

const DAY_MS = 24 * 60 * 60 * 1000;

function calendarMonthsAfter(date: Date, months: number): Date {
  const result = new Date(date);
  const day = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(day, lastDay));
  return result;
}

function validToken(token: string | null): token is string {
  if (token === null || !/^[A-Za-z0-9_-]{43}$/.test(token)) return false;
  const decoded = Buffer.from(token, "base64url");
  return decoded.length === 32 && decoded.toString("base64url") === token;
}

function unavailable(error: unknown): never {
  if (error instanceof AuthError) throw error;
  throw new AuthError("SERVICE_UNAVAILABLE");
}

export class HouseholdAuthService {
  constructor(
    private readonly repository: HouseholdSessionRepository,
    private readonly limiter: LoginAttemptLimiter,
    private readonly credentials: CredentialLookup,
    private readonly clock: Clock,
    private readonly tokens: TokenSource,
  ) {}

  async login(input: unknown): Promise<LoginResult> {
    let permitted: boolean;
    try {
      permitted = await this.limiter.consume(limiterNameMaterial(input));
    } catch (error) {
      unavailable(error);
    }
    if (!permitted) throw new AuthError("RATE_LIMITED");

    const validated = validateLoginInput(input);
    const now = this.clock.now();
    const credentialDigest = this.credentials.lookupDigest(validated.accessCode);

    let household;
    try {
      // Cleanup is deliberately bounded and is not allowed to make authentication unavailable.
      await this.repository.cleanup(now, 100).catch(() => undefined);
      household = await this.repository.findByCredentialDigest(credentialDigest);
    } catch (error) {
      unavailable(error);
    }

    if (
      !household ||
      comparableHouseholdName(household.displayName) !== validated.comparableName
    ) {
      throw new AuthError("INVALID_CREDENTIALS");
    }

    const token = this.tokens.generate();
    const expiresAt = validated.remember
      ? calendarMonthsAfter(now, 12)
      : new Date(now.getTime() + DAY_MS);

    let created;
    try {
      created = await this.repository.createIfUnchanged({
        household,
        tokenDigest: this.tokens.digest(token),
        expiresAt,
        now,
      });
    } catch (error) {
      unavailable(error);
    }
    if (!created) throw new AuthError("INVALID_CREDENTIALS");

    return { token, expiresAt, remember: validated.remember, household: created };
  }

  async resolve(token: string | null) {
    if (!validToken(token)) return null;
    try {
      return await this.repository.resolve(this.tokens.digest(token), this.clock.now());
    } catch (error) {
      unavailable(error);
    }
  }

  async logout(token: string | null): Promise<void> {
    if (!validToken(token)) return;
    try {
      await this.repository.delete(this.tokens.digest(token));
    } catch (error) {
      unavailable(error);
    }
  }
}
