import { describe, expect, it } from "vitest";
import { buildInvitationUrl, InvalidInvitationOriginError } from "../../features/households/domain/invitation-url";
import { weddingPath } from "../../features/wedding-site/paths";

const requestUrl = "http://localhost:3000/api/household-invitation";
const invitationKey = "inv_test-only-token";

describe("household invitation URLs", () => {
  it("uses the current local address before a public domain is configured", () => {
    expect(buildInvitationUrl({ requestUrl, invitationKey })).toBe(`http://localhost:3000${weddingPath("/register")}#invitation=inv_test-only-token`);
    expect(buildInvitationUrl({ requestUrl, invitationKey, publicSiteUrl: "  " })).toBe(`http://localhost:3000${weddingPath("/register")}#invitation=inv_test-only-token`);
  });

  it("prefers the configured domain over a proxy or preview hostname", () => {
    const url = new URL(buildInvitationUrl({
      requestUrl: "http://internal-proxy:3000/api/household-invitation",
      publicSiteUrl: " https://wedding.example/ ", invitationKey,
    }));
    expect(url.origin).toBe("https://wedding.example");
    expect(url.pathname).toBe(weddingPath("/register"));
    expect(url.search).toBe("");
    expect(new URLSearchParams(url.hash.slice(1)).get("invitation")).toBe(invitationKey);
  });

  it("supports the purchased internationalized domain without putting invitation keys in queries", () => {
    const url = new URL(buildInvitationUrl({ requestUrl, invitationKey, publicSiteUrl: "https://vårtja.no" }));
    expect(url.origin).toBe("https://xn--vrtja-mra.no");
    expect(url.pathname).toBe("/andrea-og-martin/register");
    expect(url.search).toBe("");
    expect(new URLSearchParams(url.hash.slice(1)).get("invitation")).toBe(invitationKey);
  });

  it("uses a hosted HTTPS request domain when no override is configured", () => {
    expect(buildInvitationUrl({ requestUrl: "https://wedding.example/api/household-invitation", invitationKey }))
      .toBe(`https://wedding.example${weddingPath("/register")}#invitation=inv_test-only-token`);
  });

  it.each([
    "wedding.example", "javascript:alert(1)", "ftp://wedding.example",
    "http://wedding.example", "https://user:password@wedding.example",
    "https://wedding.example/other-path", "https://wedding.example?query=1", "https://wedding.example#fragment",
  ])("rejects an invalid or unsafe configured origin: %s", (publicSiteUrl) => {
    expect(() => buildInvitationUrl({ requestUrl, invitationKey, publicSiteUrl })).toThrow(InvalidInvitationOriginError);
  });

  it("accepts explicit HTTP loopback addresses for isolated development tests", () => {
    expect(buildInvitationUrl({ requestUrl, invitationKey, publicSiteUrl: "http://127.0.0.1:3103" }))
      .toContain(`http://127.0.0.1:3103${weddingPath("/register")}#invitation=`);
  });
});
