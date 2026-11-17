import type { Payload } from "payload";
import type { HouseholdCredentialAuditor } from "../application/HouseholdCodeServices";

type AuditPayloadApi = {
  create(options: Record<string, unknown>): Promise<unknown>;
};

export class PayloadHouseholdAudit implements HouseholdCredentialAuditor {
  private readonly api: AuditPayloadApi;

  constructor(payload: Payload) {
    this.api = payload as unknown as AuditPayloadApi;
  }

  async record(input: {
    householdId: number;
    administratorId: number;
    action: "reveal" | "rotate";
    occurredAt: Date;
  }): Promise<void> {
    await this.api.create({
      collection: "household-credential-audits",
      overrideAccess: true,
      data: {
        household: input.householdId,
        administrator: input.administratorId,
        action: input.action,
        occurredAt: input.occurredAt.toISOString(),
      },
    });
  }
}
