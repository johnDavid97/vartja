import { describe, expect, it } from "vitest";
import {
  HouseholdRegistrationError,
  RegisterHousehold,
  type CreateRegistrationResult,
  type RegistrationRepository,
} from "../../features/households/application/HouseholdRegistration";
import { HouseholdCredentialProtection, StableInvitationKey } from "../../features/households/infrastructure/HouseholdCredentialProtection";

const secret = "test-only-household-secret-that-is-at-least-32-characters";

class FakeRepository implements RegistrationRepository {
  stored: CreateRegistrationResult | null = null;
  received: Parameters<RegistrationRepository["create"]>[0][] = [];

  async create(input: Parameters<RegistrationRepository["create"]>[0]): Promise<CreateRegistrationResult> {
    this.received.push(structuredClone(input));
    if (this.stored) return this.stored;
    const registration = {
      householdId: 12,
      status: "pending" as const,
      publicId: input.publicId,
      requestFingerprint: input.requestFingerprint,
      encryptedCode: input.code.encrypted,
      credentialVersion: 1,
    };
    this.stored = { kind: "existing", registration };
    return { kind: "created", registration };
  }
}

function setup() {
  const repository = new FakeRepository();
  const credentials = new HouseholdCredentialProtection(secret);
  const invitations = new StableInvitationKey(secret);
  let sequence = 0;
  const registration = new RegisterHousehold(
    repository,
    { consume: async () => true },
    invitations,
    credentials,
    { publicId: () => "00000000-0000-4000-8000-000000000001", memberId: () => `member-${++sequence}` },
  );
  const input = {
    invitationKey: invitations.getKey(),
    requestKey: "123e4567-e89b-42d3-a456-426614174000",
    contactName: " Kari Nordmann ",
    email: " KARI@example.com ",
    additionalMembers: [{ name: "Ola" }],
  };
  return { credentials, input, invitations, registration, repository };
}

describe("household registration", () => {
  it("prepends the normalized contact once and forces pending generated members", async () => {
    const { input, registration, repository } = setup();
    const result = await registration.register(input);
    expect(result).toMatchObject({ householdId: 12, status: "pending" });
    expect(repository.received[0]).toMatchObject({
      contactName: "Kari Nordmann",
      email: "kari@example.com",
      members: [
        { memberId: "member-1", name: "Kari Nordmann", status: "pending" },
        { memberId: "member-2", name: "Ola", status: "pending" },
      ],
    });
  });

  it("returns the original code for an identical idempotent retry", async () => {
    const { input, registration, repository } = setup();
    const first = await registration.register(input);
    const second = await registration.register(input);
    expect(second).toEqual(first);
    expect(repository.received).toHaveLength(2);
  });

  it("never reveals a replacement code through an old registration request key", async () => {
    const { input, registration, repository } = setup();
    await registration.register(input);
    if (!repository.stored || repository.stored.kind === "credential-conflict") throw new Error("Missing fixture");
    repository.stored.registration.credentialVersion = 2;
    await expect(registration.register(input)).rejects.toMatchObject({ code: "RECOVERY_UNAVAILABLE", httpStatus: 409 });
  });

  it.each(["approved", "revoked"] as const)("does not replay code recovery for %s households", async (status) => {
    const { input, registration, repository } = setup();
    await registration.register(input);
    if (!repository.stored || repository.stored.kind === "credential-conflict") throw new Error("Missing fixture");
    repository.stored.registration.status = status;
    await expect(registration.register(input)).rejects.toMatchObject({ code: "RECOVERY_UNAVAILABLE" });
  });

  it("rejects changed content under an existing request key with a typed 409", async () => {
    const { input, registration } = setup();
    await registration.register(input);
    await expect(registration.register({ ...input, contactName: "Someone else" })).rejects.toMatchObject({
      code: "IDEMPOTENCY_CONFLICT", httpStatus: 409,
    });
  });

  it("rejects invalid invitations, extra fields, member IDs and more than 50 total members", async () => {
    const { input, registration } = setup();
    await expect(registration.register({ ...input, invitationKey: "wrong" })).rejects.toMatchObject({ code: "INVALID_INVITATION", httpStatus: 403 });
    await expect(registration.register({ ...input, status: "approved" })).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(registration.register({ ...input, additionalMembers: [{ name: "Ola", id: "supplied" }] })).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(registration.register({ ...input, additionalMembers: Array.from({ length: 50 }, () => ({ name: "Guest" })) })).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });

  it("limits valid invitations without letting public requests exhaust the allowance", async () => {
    const { input } = setup();
    let consumed = 0;
    const registration = new RegisterHousehold(
      new FakeRepository(),
      { consume: async () => { consumed += 1; return false; } },
      new StableInvitationKey(secret),
      new HouseholdCredentialProtection(secret),
      { publicId: () => "unused", memberId: () => "unused" },
    );
    await expect(registration.register({ secretSubmittedData: true })).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(registration.register({ ...input, invitationKey: "wrong" })).rejects.toMatchObject({ code: "INVALID_INVITATION" });
    expect(consumed).toBe(0);
    const error = await registration.register(input).catch((caught: unknown) => caught);
    expect(consumed).toBe(1);
    expect(error).toBeInstanceOf(HouseholdRegistrationError);
    expect(error).toMatchObject({ code: "RATE_LIMITED", httpStatus: 429 });
    expect(String(error)).not.toContain("secretSubmittedData");
  });
});
