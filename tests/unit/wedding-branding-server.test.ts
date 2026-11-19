import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ connection: vi.fn(), getPayload: vi.fn(), findGlobal: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ connection: mocks.connection }));
vi.mock("payload", () => ({ getPayload: mocks.getPayload }));
vi.mock("@payload-config", () => ({ default: {} }));
import { getWeddingBranding, weddingPageMetadata } from "@/features/wedding-site/branding-server";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getPayload.mockResolvedValue({ findGlobal: mocks.findGlobal });
  mocks.findGlobal.mockResolvedValue({ coupleNames: "Åse & Øyvind" });
});

describe("public branding reader", () => {
  it("reads only configured public names using native access, not private content or identity", async () => {
    expect(await getWeddingBranding()).toEqual({ names: "Åse & Øyvind", monogram: "Å&Ø" });
    expect(mocks.connection).toHaveBeenCalled();
    expect(mocks.findGlobal).toHaveBeenCalledWith({ slug: "wedding", depth: 0, overrideAccess: false, select: { coupleNames: true } });
  });

  it("builds page-specific metadata from that same source", async () => {
    expect(await weddingPageMetadata("Program")).toEqual({
      title: "Program · Åse & Øyvind",
      icons: { icon: [{ url: "/andrea-og-martin/brand-icon?v=%C3%85%26%C3%98", type: "image/svg+xml", sizes: "any" }] },
    });
  });

  it("uses a neutral identity on read failure without logging secrets or error details", async () => {
    mocks.findGlobal.mockRejectedValueOnce(new Error("Private internal details"));
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      expect(await getWeddingBranding()).toEqual({ names: "Bryllupet vårt", monogram: "♡" });
      expect(warning).toHaveBeenCalledExactlyOnceWith("Could not load wedding branding; using a neutral fallback.");
    } finally { warning.mockRestore(); }
  });
});
