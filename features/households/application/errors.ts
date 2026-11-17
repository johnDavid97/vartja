export type HouseholdOperationErrorCode = "NOT_FOUND" | "ACCESS_REVOKED" | "STALE_HOUSEHOLD" | "IDENTIFIER_FAILURE";

const messages: Record<HouseholdOperationErrorCode, string> = {
  NOT_FOUND: "Fant ikke husstanden.",
  IDENTIFIER_FAILURE: "Kunne ikke lagre endringene. Prøv igjen senere.",
  ACCESS_REVOKED: "Tilgangen er trukket tilbake. Ta kontakt med brudeparet.",
  STALE_HOUSEHOLD: "Husstanden er endret. Last inn på nytt før du lagrer.",
};

/** Application failures have safe messages; adapters must not expose raw database errors. */
export class HouseholdOperationError extends Error {
  constructor(readonly code: HouseholdOperationErrorCode) {
    super(messages[code]);
    this.name = "HouseholdOperationError";
  }
}
