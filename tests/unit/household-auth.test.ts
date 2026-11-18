import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { HouseholdAuthService } from "@/features/households/auth/HouseholdAuthService";
import type { HouseholdSessionRepository, LoginHouseholdSnapshot } from "@/features/households/auth/ports";
import {
  canonicalizeAccessCode,
  comparableHouseholdName,
  validateLoginInput,
} from "@/features/households/auth/validation";

const CODE_A = "2345-6789-ABCD-EFGH-JKLM-NPQR";
const CODE_B = "QRST-UVWX-YZ23-4567-89AB-CDEF";
const TOKEN = Buffer.alloc(32, 7).toString("base64url");

class FakeRepository implements HouseholdSessionRepository {
  households = new Map<string, LoginHouseholdSnapshot>();
  sessions = new Map<string, { household: LoginHouseholdSnapshot; expiresAt: Date }>();

  async findByCredentialDigest(digest: string) {
    return this.households.get(digest) ?? null;
  }

  async createIfUnchanged(input: {
    household: LoginHouseholdSnapshot;
    tokenDigest: string;
    expiresAt: Date;
    now: Date;
  }) {
    const current = this.households.get(input.household.credentialDigest);
    if (!current || current.credentialVersion !== input.household.credentialVersion || current.sessionVersion !== input.household.sessionVersion || current.status !== input.household.status || current.displayName !== input.household.displayName) return null;
    this.sessions.set(input.tokenDigest, { household: { ...current }, expiresAt: input.expiresAt });
    return { householdId: current.householdId, displayName: current.displayName, status: current.status };
  }

  async resolve(tokenDigest: string, now: Date) {
    const session = this.sessions.get(tokenDigest);
    if (!session || session.expiresAt <= now) return null;
    const current = this.households.get(session.household.credentialDigest);
    if (!current || current.status === undefined || current.credentialVersion !== session.household.credentialVersion || current.sessionVersion !== session.household.sessionVersion) return null;
    return { householdId: current.householdId, displayName: current.displayName, status: current.status };
  }

  async delete(tokenDigest: string) {
    this.sessions.delete(tokenDigest);
  }

  async cleanup() {}
}

function digest(value: string): string {
  return `digest:${value}`;
}

function tokenDigest(value: string): string {
  return createHash("sha256").update(value).digest("base64url");
}

function snapshot(overrides: Partial<LoginHouseholdSnapshot> = {}): LoginHouseholdSnapshot {
  return {
    householdId: 1,
    displayName: "Familien Øst",
    status: "approved",
    credentialDigest: digest(CODE_A),
    credentialVersion: 1,
    sessionVersion: 1,
    ...overrides,
  };
}

function setup(now = new Date("2024-02-29T12:00:00.000Z")) {
  const repository = new FakeRepository();
  const limiter = { consume: async () => true };
  const clock = { now: () => new Date(now) };
  const service = new HouseholdAuthService(
    repository,
    limiter,
    { lookupDigest: digest },
    clock,
    { generate: () => TOKEN, digest: tokenDigest },
  );
  return { repository, limiter, clock, service };
}

function loginInput(code = CODE_A) {
  return { householdName: "familien øst", accessCode: code, remember: false };
}

async function expectCode(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toMatchObject({ name: "AuthError", code });
}

describe("household auth validation", () => {
  it("normalizes NFKC, Norwegian casing, whitespace and grouped codes", () => {
    expect(comparableHouseholdName("  FAMILIEN\tØST  ")).toBe("familienøst");
    expect(comparableHouseholdName("Ｆamilien Øst")).toBe("familienøst");
    expect(canonicalizeAccessCode("2345 6789-abcd efgh-jklm npqr")).toBe(CODE_A);
  });

  it("requires the exact input shape and returns only generic input errors", () => {
    const malformed = [
      null,
      { householdName: "x", accessCode: CODE_A, remember: false, extra: true },
      { householdName: "x", accessCode: "short", remember: false },
      { householdName: " ", accessCode: CODE_A, remember: false },
      { householdName: "x", accessCode: CODE_A, remember: "yes" },
    ];
    for (const input of malformed) {
      expect(() => validateLoginInput(input)).toThrowError(expect.objectContaining({ code: "INVALID_INPUT" }));
    }
  });
});

describe("household auth service", () => {
  it("distinguishes duplicate display names by high-entropy code digest", async () => {
    const { repository, service } = setup();
    repository.households.set(digest(CODE_A), snapshot());
    repository.households.set(digest(CODE_B), snapshot({ householdId: 2, credentialDigest: digest(CODE_B) }));

    const result = await service.login(loginInput(CODE_B.toLowerCase()));
    expect(result.household.householdId).toBe(2);
  });

  it.each(["familienøst", "F A M I L I E N Ø S T", "  Familien  Øst  "])("ignores login spacing for %s without changing the displayed name", async (householdName) => {
    const { repository, service } = setup();
    repository.households.set(digest(CODE_A), snapshot());
    const result = await service.login({ ...loginInput(), householdName });
    expect(result.household.displayName).toBe(snapshot().displayName);
  });

  it("uses 24 hours for transient sessions and twelve calendar months when remembered", async () => {
    const { repository, service } = setup();
    repository.households.set(digest(CODE_A), snapshot());

    const transient = await service.login(loginInput());
    expect(transient.expiresAt.toISOString()).toBe("2024-03-01T12:00:00.000Z");
    const remembered = await service.login({ ...loginInput(), remember: true });
    expect(remembered.expiresAt.toISOString()).toBe("2025-02-28T12:00:00.000Z");
    expect(remembered.remember).toBe(true);
  });

  it("denies wrong names, unknown codes and revoked households generically", async () => {
    const { repository, service } = setup();
    repository.households.set(digest(CODE_A), snapshot());
    await expectCode(service.login({ ...loginInput(), householdName: "En annen" }), "INVALID_CREDENTIALS");
    await expectCode(service.login(loginInput(CODE_B)), "INVALID_CREDENTIALS");
    repository.households.delete(digest(CODE_A)); // Production lookup excludes revoked rows.
    await expectCode(service.login(loginInput()), "INVALID_CREDENTIALS");
  });

  it("invalidates sessions on session-version changes and supports expiry and logout", async () => {
    const now = new Date("2025-01-01T00:00:00.000Z");
    const { repository, clock, service } = setup(now);
    repository.households.set(digest(CODE_A), snapshot());
    await service.login(loginInput());
    expect(await service.resolve(TOKEN)).toMatchObject({ householdId: 1 });

    repository.households.set(digest(CODE_A), snapshot({ sessionVersion: 2 }));
    expect(await service.resolve(TOKEN)).toBeNull();

    repository.households.set(digest(CODE_A), snapshot());
    await service.login(loginInput());
    await service.logout(TOKEN);
    expect(await service.resolve(TOKEN)).toBeNull();

    await service.login(loginInput());
    clock.now = () => new Date(now.getTime() + 24 * 60 * 60 * 1000);
    expect(await service.resolve(TOKEN)).toBeNull();
  });

  it("fails closed when the durable limiter is unavailable", async () => {
    const { limiter, service } = setup();
    limiter.consume = async () => { throw new Error("database unavailable"); };
    await expectCode(service.login(loginInput()), "SERVICE_UNAVAILABLE");
  });

  it("consumes limiter capacity before rejecting malformed input", async () => {
    let consumed = "";
    const repository = new FakeRepository();
    const service = new HouseholdAuthService(
      repository,
      { consume: async (name) => { consumed = name; return true; } },
      { lookupDigest: digest },
      { now: () => new Date() },
      { generate: () => TOKEN, digest: tokenDigest },
    );
    await expectCode(service.login({ householdName: "  NAVN ", accessCode: "bad", remember: false }), "INVALID_INPUT");
    expect(consumed).toBe("navn");
  });
});
