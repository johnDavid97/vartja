import type { HouseholdCredentialService, ProtectedHouseholdCode } from "./HouseholdRegistration";
import { HouseholdRegistrationError } from "./HouseholdRegistration";

export interface HouseholdCodeRecord {
  householdId: number;
  publicId: string;
  encryptedCode: string;
  credentialVersion: number;
}

export interface HouseholdCodeRepository {
  findCredentials(householdId: number): Promise<HouseholdCodeRecord | null>;
  rotateCredentials(
    householdId: number,
    expectedCredentialVersion: number,
    code: ProtectedHouseholdCode,
    audit: HouseholdCredentialAudit,
  ): Promise<boolean>;
}

export interface HouseholdCredentialAudit {
  householdId: number;
  administratorId: number;
  action: "reveal" | "rotate";
  occurredAt: Date;
}

export interface HouseholdCredentialAuditor {
  record(input: HouseholdCredentialAudit): Promise<void>;
}

export interface Clock {
  now(): Date;
}

function validateIdentifier(value: number): void {
  if (!Number.isSafeInteger(value) || value <= 0) throw new HouseholdRegistrationError("INVALID_INPUT");
}

export class RevealHouseholdCode {
  constructor(
    private readonly repository: HouseholdCodeRepository,
    private readonly credentials: HouseholdCredentialService,
    private readonly auditor: HouseholdCredentialAuditor,
    private readonly clock: Clock,
  ) {}

  async reveal(householdId: number, administratorId: number): Promise<string> {
    validateIdentifier(householdId);
    validateIdentifier(administratorId);
    let record: HouseholdCodeRecord | null;
    try {
      record = await this.repository.findCredentials(householdId);
    } catch {
      throw new HouseholdRegistrationError("SERVICE_UNAVAILABLE");
    }
    if (!record) throw new HouseholdRegistrationError("NOT_FOUND");

    let code: string;
    try {
      code = this.credentials.revealCode(record.encryptedCode, record.publicId);
      await this.auditor.record({ householdId, administratorId, action: "reveal", occurredAt: this.clock.now() });
    } catch {
      throw new HouseholdRegistrationError("SERVICE_UNAVAILABLE");
    }
    return code;
  }
}

export class RotateHouseholdCode {
  constructor(
    private readonly repository: HouseholdCodeRepository,
    private readonly credentials: HouseholdCredentialService,
    private readonly clock: Clock,
  ) {}

  async rotate(householdId: number, administratorId: number): Promise<string> {
    validateIdentifier(householdId);
    validateIdentifier(administratorId);

    for (let attempt = 0; attempt < 3; attempt += 1) {
      let record: HouseholdCodeRecord | null;
      try {
        record = await this.repository.findCredentials(householdId);
      } catch {
        throw new HouseholdRegistrationError("SERVICE_UNAVAILABLE");
      }
      if (!record) throw new HouseholdRegistrationError("NOT_FOUND");

      let code: string;
      let protectedCode: ProtectedHouseholdCode;
      try {
        code = this.credentials.generateCode();
        protectedCode = this.credentials.protectCode(code, record.publicId);
      } catch {
        throw new HouseholdRegistrationError("SERVICE_UNAVAILABLE");
      }
      try {
        const rotated = await this.repository.rotateCredentials(
          householdId,
          record.credentialVersion,
          protectedCode,
          { householdId, administratorId, action: "rotate", occurredAt: this.clock.now() },
        );
        if (!rotated) continue;
        return code;
      } catch {
        throw new HouseholdRegistrationError("SERVICE_UNAVAILABLE");
      }
    }
    throw new HouseholdRegistrationError("SERVICE_UNAVAILABLE");
  }
}
