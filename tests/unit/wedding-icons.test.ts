import { describe, expect, it } from "vitest";
import { monogramIconSvg, weddingIcons, vartjaIcons } from "@/features/wedding-site/icons";
import { weddingBranding } from "@/features/wedding-site/branding";

describe("tab icons", () => {
  it("escapes configured text rather than allowing SVG markup", () => {
    const svg = monogramIconSvg('<script>"&\'');
    expect(svg).not.toContain("<script>");
    expect(svg).toContain("&lt;script&gt;&quot;&amp;&apos;");
  });
  it("supports Unicode initials and the neutral heart", () => {
    expect(monogramIconSvg("Å&Ø")).toContain("Å&amp;Ø");
    expect(monogramIconSvg(weddingBranding().monogram)).toContain("♡");
  });
  it("changes the icon URL with saved initials without changing the wedding path", () => {
    expect(weddingIcons(weddingBranding("Andrea & Martin"))).toEqual({ icon: [{
      url: "/andrea-og-martin/brand-icon?v=A%26M", type: "image/svg+xml", sizes: "any",
    }] });
    expect(weddingIcons(weddingBranding("Åse & Øyvind"))).not.toEqual(weddingIcons(weddingBranding("Andrea & Martin")));
    expect(vartjaIcons).toEqual({ icon: [{ url: "/vartja-icon.svg", type: "image/svg+xml", sizes: "any" }] });
  });
});
