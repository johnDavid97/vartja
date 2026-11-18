import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ value: "pending", disabled: false, modified: false, rowCount: 1 }));
vi.mock("@payloadcms/ui", () => ({
  useField: () => ({ value: state.value, setValue: vi.fn(), disabled: state.disabled, path: "members", rows: Array.from({ length: state.rowCount }, (_, index) => ({ id: `row-${index}` })) }),
  useForm: () => ({ addFieldRow: vi.fn(), removeFieldRow: vi.fn(), moveFieldRow: vi.fn() }),
  FieldError: () => null,
  FieldDescription: () => null,
  RenderFields: ({ readOnly }: { readOnly?: boolean }) => <div data-readonly={readOnly} />,
  useDocumentInfo: () => ({ data: { contactName: "Kari Nordmann", status: "approved" } }),
  useFormModified: () => state.modified,
}));
import HouseholdApprovalField from "../../components/admin/households/HouseholdApprovalField";
import HouseholdHeading from "../../components/admin/households/HouseholdHeading";
import HouseholdMemberStatusField from "../../components/admin/households/HouseholdMemberStatusField";
import HouseholdMembersField from "../../components/admin/households/HouseholdMembersField";

const field = { name: "status", type: "select" as const, options: ["pending", "approved", "revoked"], required: true };
beforeEach(() => { state.value = "pending"; state.disabled = false; state.modified = false; state.rowCount = 1; });

describe("household editor presentation", () => {
  it("makes approval an explicit form choice rather than an implicit save", () => {
    const html = renderToStaticMarkup(<HouseholdApprovalField path="status" field={field} />);
    expect(html).toContain("Valget lagres når du trykker");
    expect(html).toContain("Godkjenn husstanden");
    expect(html).toContain("Avslå husstanden");
    expect(html.match(/type="button"/g)).toHaveLength(3);
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(1);
  });
  it("honours both configured and form-level read-only states", () => {
    const readonly = renderToStaticMarkup(<HouseholdApprovalField path="status" field={field} readOnly />);
    expect(readonly.match(/disabled=""/g)).toHaveLength(3);
    state.disabled = true;
    const disabled = renderToStaticMarkup(<HouseholdApprovalField path="status" field={field} />);
    expect(disabled.match(/disabled=""/g)).toHaveLength(3);
  });
  it("distinguishes saved approval from unsaved form edits", () => {
    expect(renderToStaticMarkup(<HouseholdHeading />)).toContain("Godkjent");
    state.modified = true;
    expect(renderToStaticMarkup(<HouseholdHeading />)).toContain("Ulagrede endringer");
  });
  it("presents each member's status as two accessible radio toggles", () => {
    const html = renderToStaticMarkup(<HouseholdMemberStatusField path="members.0.status" field={field} readOnly />);
    expect(html.match(/type="radio"/g)).toHaveLength(2);
    expect(html.match(/checked=""/g)).toHaveLength(1);
    expect(html).toContain("<fieldset");
    expect(html).toContain('disabled=""');
    expect(html).toContain("Venter");
    expect(html).toContain("Godkjent");
    expect(html).not.toContain("revoked");
  });
  it("makes reorder controls optional through Payload's isSortable setting", () => {
    const arrayField = { name: "members", type: "array" as const, fields: [], minRows: 1, maxRows: 50 };
    state.rowCount = 2;
    for (const isSortable of [true, false]) {
      const html = renderToStaticMarkup(<HouseholdMembersField path="members" field={{ ...arrayField, admin: { isSortable, initCollapsed: false } }} />);
      expect(html.includes("Flytt familiemedlem")).toBe(isSortable);
      expect(html).toContain("Fjern familiemedlem 1");
      expect(html).toContain("Fjern familiemedlem 2");
      expect(html).toContain("Legg til Familiemedlem");
    }
    const defaultHtml = renderToStaticMarkup(<HouseholdMembersField path="members" field={arrayField} />);
    expect(defaultHtml).toContain("Flytt familiemedlem");
  });
  it("preserves array limits and locks native child fields in read-only mode", () => {
    const arrayField = { name: "members", type: "array" as const, fields: [], minRows: 1, maxRows: 50 };
    const single = renderToStaticMarkup(<HouseholdMembersField path="members" field={arrayField} />);
    expect(single.match(/disabled=""/g)).toHaveLength(3); // Up, down, and remove for the sole member.
    const readonly = renderToStaticMarkup(<HouseholdMembersField path="members" field={arrayField} readOnly />);
    expect(readonly).toContain('data-readonly="true"');
    expect(readonly.match(/disabled=""/g)).toHaveLength(4);
    state.rowCount = 50;
    const full = renderToStaticMarkup(<HouseholdMembersField path="members" field={arrayField} />);
    const addButton = full.match(/<button\b[^>]*>[\s\S]*?<\/button>/g)?.find((button) => button.includes("Legg til Familiemedlem"));
    expect(addButton).toMatch(/^<button[^>]*disabled=""/);
  });
});
