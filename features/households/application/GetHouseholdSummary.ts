import { HouseholdRegistrationError } from "./HouseholdRegistration";

export interface HouseholdSummary {
  total: number;
  pending: number;
}

export interface HouseholdSummaryRepository {
  getSummary(): Promise<HouseholdSummary>;
}

export class GetHouseholdSummary {
  constructor(private readonly repository: HouseholdSummaryRepository) {}

  async get(): Promise<HouseholdSummary> {
    try {
      return await this.repository.getSummary();
    } catch {
      throw new HouseholdRegistrationError("SERVICE_UNAVAILABLE");
    }
  }
}
