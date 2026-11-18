import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import Header from "@/components/Header";

vi.mock("next/navigation", () => ({ usePathname: () => "/program" }));

describe("website navigation", () => {
  it.each(["approved", "administrator"] as const)("only includes the remaining wedding pages for %s", (access) => {
    const html = renderToStaticMarkup(<Header access={access} />);
    for (const path of ["/", "/program", "/news", "/bilder"]) expect(html).toContain(`href="${path}"`);
    for (const path of ["/reiseplan", "/ting-a-gjore", "/wedding-party"]) expect(html).not.toContain(path);
    expect(html).not.toContain("<details");
    expect(html).toContain('aria-current="page"');
  });
});
