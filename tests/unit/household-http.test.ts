import { describe, expect, it, vi } from "vitest";
import { HouseholdRegistrationError } from "../../features/households/application/HouseholdRegistration";
import { householdErrorResponse, householdResponse, readHouseholdRequest } from "../../features/households/http/requests";

function registrationRequest(body: string, headers: Record<string, string> = {}) {
  return new Request("http://localhost:3000/api/household-registration", {
    method: "POST",
    headers: { origin: "http://localhost:3000", "content-type": "application/json", ...headers },
    body,
  });
}

describe("household HTTP boundary", () => {
  it("reads same-origin JSON", async () => {
    await expect(readHouseholdRequest(registrationRequest('{"contactName":"Alex"}'))).resolves.toEqual({ contactName: "Alex" });
  });

  it.each<Record<string, string>>([{ origin: "https://other.example" }, { origin: "" }, { "sec-fetch-site": "cross-site" }])("rejects untrusted origin %j", async (headers) => {
    await expect(readHouseholdRequest(registrationRequest("{}", headers))).rejects.toMatchObject({ status: 403 });
  });

  it("rejects non-JSON and malformed JSON", async () => {
    await expect(readHouseholdRequest(registrationRequest("{}", { "content-type": "text/plain" }))).rejects.toMatchObject({ status: 415 });
    await expect(readHouseholdRequest(registrationRequest("{"))).rejects.toMatchObject({ status: 400 });
  });

  it("enforces actual body size even when content-length is absent or false", async () => {
    await expect(readHouseholdRequest(registrationRequest('"' + "x".repeat(50) + '"', { "content-length": "2" }), 16)).rejects.toMatchObject({ status: 413 });
    await expect(readHouseholdRequest(registrationRequest("{}", { "content-length": "500" }), 16)).rejects.toMatchObject({ status: 413 });
  });

  it("marks credential responses as non-cacheable", () => {
    const response = householdResponse({ accessCode: "test-only" });
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
  });

  it("serializes known safe errors but never infrastructure messages", async () => {
    const known = householdErrorResponse(new HouseholdRegistrationError("INVALID_INVITATION"));
    expect(known.status).toBe(403);
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const unknown = householdErrorResponse(new Error("secret database parameters"));
      expect(unknown.status).toBe(500);
      expect(await unknown.text()).not.toContain("secret database parameters");
      expect(log).not.toHaveBeenCalledWith(expect.stringContaining("secret database parameters"));
    } finally { log.mockRestore(); }
  });
});
