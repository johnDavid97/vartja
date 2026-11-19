import { describe, expect, it } from "vitest";
import { WEDDING_BASE_PATH, weddingPath, weddingRedirects } from "../../features/wedding-site/paths";

describe("wedding website paths", () => {
  it("prefixes only explicit website paths and handles the wedding root", () => {
    expect(WEDDING_BASE_PATH).toBe("/andrea-og-martin");
    expect(weddingPath()).toBe("/andrea-og-martin");
    expect(weddingPath("/news/42")).toBe("/andrea-og-martin/news/42");
  });

  it("defines narrow compatibility aliases with the intended permanence", () => {
    expect(weddingRedirects()).toEqual([
      { source: "/", destination: weddingPath(), permanent: false },
      { source: weddingPath("/admin/:path*"), destination: "/admin/:path*", permanent: false },
      { source: "/news", destination: weddingPath("/news"), permanent: true },
      { source: "/program", destination: weddingPath("/program"), permanent: true },
      { source: "/bilder", destination: weddingPath("/bilder"), permanent: true },
      { source: "/login", destination: weddingPath("/login"), permanent: true },
      { source: "/waiting", destination: weddingPath("/waiting"), permanent: true },
      { source: "/register", destination: weddingPath("/register"), permanent: true },
      { source: "/news/:id", destination: weddingPath("/news/:id"), permanent: true },
      { source: "/tidsplan", destination: weddingPath("/news"), permanent: true },
    ]);
  });

  it("does not create broad slug, API, admin or removed-page redirects", () => {
    const sources = weddingRedirects().map(({ source }) => source);
    expect(sources).not.toContain("/:slug");
    expect(sources).not.toContain("/:path*");
    expect(sources).not.toContain("/api/:path*");
    expect(sources).not.toContain("/admin/:path*");
    expect(sources).not.toContain("/reiseplan");
    expect(sources).not.toContain("/ting-a-gjore");
    expect(sources).not.toContain("/wedding-party");
  });
});
