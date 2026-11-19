import { describe, expect, it, vi } from "vitest";

describe("trusted administrator creation context", () => {
  it("retains identity across separate config/service module instances", async () => {
    const configModule = await import("@/collections/Households");
    const configToken = configModule.trustedAdminHouseholdCreationContext().householdTrustedAdminCreation;
    vi.resetModules();
    const serviceModule = await import("@/collections/Households");
    const serviceToken = serviceModule.trustedAdminHouseholdCreationContext().householdTrustedAdminCreation;
    expect(serviceToken).toBe(configToken);
  });

  it("cannot be copied into a JSON request", async () => {
    const { trustedAdminHouseholdCreationContext } = await import("@/collections/Households");
    const context = trustedAdminHouseholdCreationContext();
    const copied = JSON.parse(JSON.stringify(context));
    expect(copied.householdTrustedAdminCreation).not.toBe(context.householdTrustedAdminCreation);
    expect(context.householdTrustedAdminCreation).not.toBe("vartja.households.trusted-admin-creation");
    expect(context.householdTrustedAdminCreation).not.toBe(Symbol.for("vartja.households.trusted-admin-creation"));
  });
});
