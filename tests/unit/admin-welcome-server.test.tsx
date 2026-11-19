import type { ReactNode } from "react";
import type { AdminViewServerProps } from "payload";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSummary: vi.fn(), count: vi.fn(), error: vi.fn(),
  redirect: vi.fn((path: string): never => { throw new Error(`REDIRECT:${path}`); }),
}));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@payloadcms/ui", () => ({ Gutter: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock("@/features/households/composition-root", () => ({ getHouseholdSummaryServices: () => ({ get: mocks.getSummary }) }));
vi.mock("@/components/admin/WelcomeView", () => ({ default: ({ summary }: { summary: unknown }) => <pre>{JSON.stringify(summary)}</pre> }));
import Welcome from "@/components/admin/Welcome";
import { publishedGuestPosts } from "@/features/households/auth/access";

function props(collection: string | null = "users", canAccessAdmin = true): AdminViewServerProps {
  return {
    initPageResult: {
      req: { user: collection ? { collection, id: 1 } : null, payload: { count: mocks.count, logger: { error: mocks.error } } },
      permissions: { canAccessAdmin },
    },
  } as unknown as AdminViewServerProps;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSummary.mockResolvedValue({ total: 12, pending: 2 });
  mocks.count.mockResolvedValue({ totalDocs: 4 });
});

describe("admin dashboard server boundary", () => {
  it("loads only aggregate values and counts published guest-visible posts with native access", async () => {
    const input = props();
    const html = renderToStaticMarkup(await Welcome(input));
    expect(html).toContain("&quot;totalHouseholds&quot;:12");
    expect(html).toContain("&quot;pendingHouseholds&quot;:2");
    expect(html).toContain("&quot;visiblePosts&quot;:4");
    expect(mocks.count).toHaveBeenCalledWith({ collection: "posts", where: publishedGuestPosts, req: input.initPageResult.req, overrideAccess: false });
    expect(mocks.error).not.toHaveBeenCalled();
  });

  it.each([[null, false], ["households", true], ["users", false]] as const)("blocks identity %s with admin permission %s before reading counts", async (collection, allowed) => {
    await expect(Welcome(props(collection, allowed))).rejects.toThrow("REDIRECT:/admin/login");
    expect(mocks.getSummary).not.toHaveBeenCalled();
    expect(mocks.count).not.toHaveBeenCalled();
  });

  it.each(["households", "posts"])("keeps the dashboard renderable with unknown rather than zero counts when %s cannot load", async (source) => {
    (source === "households" ? mocks.getSummary : mocks.count).mockRejectedValueOnce(new Error("Unavailable"));
    expect(renderToStaticMarkup(await Welcome(props()))).toBe("<div><pre>null</pre></div>");
    expect(mocks.error).toHaveBeenCalledWith("Could not load the admin dashboard summary.");
  });
});
