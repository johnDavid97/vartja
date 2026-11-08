import { renderToStaticMarkup } from "react-dom/server";
import Link from "next/link";
import { describe, expect, it } from "vitest";
import { AdminButton, adminButtonStyles } from "@/components/admin/AdminButton";

describe("AdminButton", () => {
  it("does not accidentally submit a form", () => {
    const html = renderToStaticMarkup(<AdminButton>Open</AdminButton>);
    expect(html).toContain('type="button"');
    expect(html).toContain("admin-button--primary");
  });
  it("allows explicit submit buttons", () => {
    expect(renderToStaticMarkup(<AdminButton type="submit">Save</AdminButton>)).toContain('type="submit"');
  });
  it("disables loading buttons and exposes their state", () => {
    const html = renderToStaticMarkup(<AdminButton loading>Uploading</AdminButton>);
    expect(html).toContain('disabled=""');
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain("admin-button__spinner");
  });
  it("preserves accessible names and native properties", () => {
    const html = renderToStaticMarkup(<AdminButton variant="ghost" size="icon" aria-label="Close" disabled data-testid="close">×</AdminButton>);
    expect(html).toContain('aria-label="Close"');
    expect(html).toContain('data-testid="close"');
    expect(html).toContain("admin-button--icon");
    expect(html).toContain('disabled=""');
  });
  it("supports specialised drag controls without imposing an action-button layout", () => {
    const html = renderToStaticMarkup(<AdminButton variant="plain" draggable className="post-builder__block">Photo</AdminButton>);
    expect(html).toContain('draggable="true"');
    expect(html).toContain("admin-button--plain");
    expect(html).toContain("post-builder__block");
  });
  it("shares styles with links without changing their semantics", () => {
    const html = renderToStaticMarkup(<Link href="/admin" className={adminButtonStyles({ variant: "secondary" })}>Admin</Link>);
    expect(html).toContain('href="/admin"');
    expect(html).not.toContain("<button");
    expect(html).not.toContain('role="button"');
  });
});
