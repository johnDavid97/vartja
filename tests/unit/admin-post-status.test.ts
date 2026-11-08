import { describe, expect, it } from "vitest";
import { adminPostStatus } from "@/lib/admin-post-status";

describe("admin post status", () => {
  it("distinguishes public and private publication", () => {
    expect(adminPostStatus("published", "public")).toEqual({ tone: "published", label: "Publisert" });
    expect(adminPostStatus("published", "private")).toEqual({ tone: "private", label: "Privat" });
  });
  it("never labels a private draft as published", () => {
    expect(adminPostStatus("draft", "private")).toEqual({ tone: "draft", label: "Utkast · privat" });
    expect(adminPostStatus("draft", "public").label).toBe("Utkast");
  });
  it("preserves the distinction between a live post and unsaved-to-live changes", () => {
    expect(adminPostStatus("changed", "public").label).toBe("Upubliserte endringer");
    expect(adminPostStatus("changed", "private").label).toBe("Endringer · privat");
  });
  it("supports legacy visibility and missing status without inventing publication", () => {
    expect(adminPostStatus("published", undefined).label).toBe("Publisert");
    expect(adminPostStatus(undefined, undefined).label).toBe("Utkast");
  });
});
