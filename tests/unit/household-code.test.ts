import { describe, expect, it } from "vitest";
import { RevealHouseholdCode, RotateHouseholdCode, type HouseholdCodeRecord } from "../../features/households/application/HouseholdCodeServices";
import { HouseholdCredentialProtection, StableInvitationKey } from "../../features/households/infrastructure/HouseholdCredentialProtection";

const secret = "test-only-household-secret-that-is-at-least-32-characters";

describe("household credential protection", () => {
  it("generates readable, varying codes", () => {
    const protection = new HouseholdCredentialProtection(secret);
    const generated = new Set(Array.from({ length: 100 }, () => protection.generateCode()));
    expect(generated.size).toBe(100);
    for (const code of generated) expect(code).toMatch(/^[23456789A-HJ-NP-Z]{4}(?:-[23456789A-HJ-NP-Z]{4}){5}$/);
  });

  it("uses independent lookup digests and authenticated encryption bound to public ID", () => {
    const protection = new HouseholdCredentialProtection(secret);
    const code = "2345-6789-ABCD-EFGH-JKLM-NPQR";
    const protectedCode = protection.protectCode(code, "household-public-a");
    expect(protectedCode.encrypted).not.toContain(code);
    expect(protectedCode.digest).not.toBe(protectedCode.encrypted);
    expect(protection.revealCode(protectedCode.encrypted, "household-public-a")).toBe(code);
    expect(() => protection.revealCode(protectedCode.encrypted, "household-public-b")).toThrow();
    const wrongSecret = new HouseholdCredentialProtection("another-test-secret-that-is-definitely-at-least-32-characters");
    expect(() => wrongSecret.revealCode(protectedCode.encrypted, "household-public-a")).toThrow();

    const encryptedParts = protectedCode.encrypted.split(".");
    const authenticationTag = Buffer.from(encryptedParts[3], "base64url");
    authenticationTag[0] ^= 1;
    encryptedParts[3] = authenticationTag.toString("base64url");
    const tampered = encryptedParts.join(".");
    expect(() => protection.revealCode(tampered, "household-public-a")).toThrow();
  });

  it("keeps invitation keys stable for one secret and rejects other values", () => {
    const first = new StableInvitationKey(secret);
    const restarted = new StableInvitationKey(secret);
    expect(restarted.getKey()).toBe(first.getKey());
    expect(first.getKey().length).toBeGreaterThan(20);
    expect(first.verify(first.getKey())).toBe(true);
    expect(first.verify(`${first.getKey()}x`)).toBe(false);
  });
});

describe("household code administration", () => {
  it("reveals, requests rotation with an audit, bumps the fake version and excludes credentials from audit data", async () => {
    const credentials = new HouseholdCredentialProtection(secret);
    const initial = credentials.protectCode("2345-6789-ABCD-EFGH-JKLM-NPQR", "public-id");
    let record: HouseholdCodeRecord = {
      householdId: 9, publicId: "public-id", encryptedCode: initial.encrypted, credentialVersion: 4,
    };
    const audits: unknown[] = [];
    const repository = {
      findCredentials: async () => structuredClone(record),
      rotateCredentials: async (_id: number, expected: number, code: { encrypted: string }, audit: unknown) => {
        if (expected !== record.credentialVersion) return false;
        record = { ...record, encryptedCode: code.encrypted, credentialVersion: expected + 1 };
        audits.push(audit);
        return true;
      },
    };
    const auditor = { record: async (audit: unknown) => { audits.push(audit); } };
    const clock = { now: () => new Date("2026-01-01T00:00:00.000Z") };
    const reveal = new RevealHouseholdCode(repository, credentials, auditor, clock);
    const rotate = new RotateHouseholdCode(repository, credentials, clock);

    expect(await reveal.reveal(9, 2)).toBe("2345-6789-ABCD-EFGH-JKLM-NPQR");
    const replacement = await rotate.rotate(9, 2);
    expect(replacement).not.toBe("2345-6789-ABCD-EFGH-JKLM-NPQR");
    expect(record.credentialVersion).toBe(5);
    expect(credentials.revealCode(record.encryptedCode, "public-id")).toBe(replacement);
    expect(audits).toEqual([
      { householdId: 9, administratorId: 2, action: "reveal", occurredAt: clock.now() },
      { householdId: 9, administratorId: 2, action: "rotate", occurredAt: clock.now() },
    ]);
    expect(JSON.stringify(audits)).not.toContain(replacement);
  });

  it("fails safely for invalid or missing IDs", async () => {
    const credentials = new HouseholdCredentialProtection(secret);
    const repository = {
      findCredentials: async () => null,
      rotateCredentials: async () => false,
    };
    const auditor = { record: async () => undefined };
    const clock = { now: () => new Date() };
    await expect(new RevealHouseholdCode(repository, credentials, auditor, clock).reveal(0, 1)).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(new RevealHouseholdCode(repository, credentials, auditor, clock).reveal(10, 1)).rejects.toMatchObject({ code: "NOT_FOUND", httpStatus: 404 });
  });
});
