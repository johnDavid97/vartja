import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import Header from "@/components/Header";
import { weddingPath } from "@/features/wedding-site/paths";

vi.mock("next/navigation", () => ({ usePathname: () => "/andrea-og-martin/program" }));

describe("website navigation", () => {
  it.each(["approved", "administrator"] as const)("only includes the remaining wedding pages for %s", (access) => {
    const html = renderToStaticMarkup(<Header access={access} />);
    for (const path of [weddingPath(), weddingPath("/program"), weddingPath("/news"), weddingPath("/bilder")]) {
      expect(html).toContain(`href="${path}"`);
    }
    for (const path of ["/reiseplan", "/ting-a-gjore", "/wedding-party"]) expect(html).not.toContain(path);
    expect(html).not.toContain("<details");
    expect(html).toContain('aria-current="page"');
  });
});
