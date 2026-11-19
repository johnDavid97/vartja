import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  value: "pending",
  disabled: false,
  modified: false,
  rowCount: 1,
  displayName: "Familien Nordmann",
  memberStatuses: ["pending"] as string[],
  memberNames: ["Kari Nordmann"] as string[],
}));

vi.mock("@payloadcms/ui", () => ({
  useField: () => ({ value: state.value, setValue: vi.fn(), disabled: state.disabled, path: "members", rows: Array.from({ length: state.rowCount }, (_, index) => ({ id: `row-${index}` })) }),
  useForm: () => ({ addFieldRow: vi.fn(), dispatchFields: vi.fn(), removeFieldRow: vi.fn(), moveFieldRow: vi.fn(), setModified: vi.fn() }),
  useFormFields: (selector: (context: [Record<string, { value: unknown }>, ReturnType<typeof vi.fn>]) => unknown) => {
    const fields: Record<string, { value: unknown }> = { displayName: { value: state.displayName } };
    for (let index = 0; index < state.rowCount; index += 1) {
      fields[`members.${index}.name`] = { value: state.memberNames[index] ?? `Medlem ${index + 1}` };
      fields[`members.${index}.status`] = { value: state.memberStatuses[index] ?? "pending" };
    }
    return selector([fields, vi.fn()]);
  },
  FieldError: () => null,
  FieldDescription: () => null,
  RenderFields: ({ readOnly }: { readOnly?: boolean }) => <div data-readonly={readOnly} />,
  useDocumentInfo: () => ({ id: 12, data: { contactName: "Kari Nordmann", displayName: "Lagret navn", members: [{ status: "approved" }], createdAt: "2026-11-17T20:47:00.000Z", updatedAt: "2026-11-17T20:48:00.000Z" } }),
  useFormModified: () => state.modified,
}));

import HouseholdAccessCode from "../../components/admin/households/HouseholdAccessCode";
import HouseholdApprovalField from "../../components/admin/households/HouseholdApprovalField";
import HouseholdHeading from "../../components/admin/households/HouseholdHeading";
import HouseholdMemberStatusField from "../../components/admin/households/HouseholdMemberStatusField";
import HouseholdMembersField from "../../components/admin/households/HouseholdMembersField";

const field = { name: "status", type: "select" as const, options: ["pending", "approved", "revoked"], required: true };

beforeEach(() => {
  state.value = "pending";
  state.disabled = false;
  state.modified = false;
  state.rowCount = 1;
  state.displayName = "Familien Nordmann";
  state.memberStatuses = ["pending"];
  state.memberNames = ["Kari Nordmann"];
});

describe("household editor presentation", () => {
  it("does not expose an independently editable household status", () => {
    expect(renderToStaticMarkup(<HouseholdApprovalField path="status" field={field} />)).toBe("");
  });

  it("shows the live household name, derived status and a separate unsaved indicator", () => {
    let html = renderToStaticMarkup(<HouseholdHeading />);
    expect(html).toContain("Familien Nordmann");
    expect(html).toContain("Venter");
    expect(html).not.toContain("Ikke lagret");

    state.memberStatuses = ["revoked", "approved"];
    state.memberNames.push("Ola Nordmann");
    state.rowCount = 2;
    state.modified = true;
    html = renderToStaticMarkup(<HouseholdHeading />);
    expect(html).toContain("Godkjent");
    expect(html).toContain("Ikke lagret");
  });

  it("keeps code reveal separate with eye, copy and immediate rotation controls", () => {
    const html = renderToStaticMarkup(<HouseholdAccessCode field={{ name: "accessCodeControls", type: "ui", admin: {} }} path="accessCodeControls" />);
    expect(html).toContain("Vis husstandskoden");
    expect(html).toContain("Kopier koden");
    expect(html).toContain("Lag ny kode");
    expect(html).toContain("loggføres separat");
    expect(html).toContain("Opprettet");
    expect(html).not.toContain("Slett husstanden");
  });

  it("presents each member status as three accessible radio choices", () => {
    const html = renderToStaticMarkup(<HouseholdMemberStatusField path="members.0.status" field={field} readOnly />);
    expect(html.match(/type="radio"/g)).toHaveLength(3);
    expect(html.match(/checked=""/g)).toHaveLength(1);
    expect(html).toContain("<fieldset");
    expect(html).toContain('disabled=""');
    expect(html).toContain("Venter");
    expect(html).toContain("Godkjent");
    expect(html).toContain("Avslått");
  });

  it("shows approved count, initials and a save-bound approve-all action", () => {
    state.rowCount = 3;
    state.memberNames = ["Kari Nordmann", "Ola Nordmann", "Emma Nordmann"];
    state.memberStatuses = ["approved", "revoked", "pending"];
    const arrayField = { name: "members", type: "array" as const, fields: [], minRows: 1, maxRows: 50, admin: { isSortable: false, initCollapsed: false } };
    const html = renderToStaticMarkup(<HouseholdMembersField path="members" field={arrayField} />);
    expect(html).toContain("1 av 3 godkjent");
    expect(html).toContain("Godkjenn alle");
    expect(html).toContain("KN");
    expect(html).toContain("Endringene lagres først når du trykker");
    expect(html).not.toContain("Flytt familiemedlem");
  });

  it("disables approve-all when child status updates are denied or configured read-only", () => {
    const baseArrayField = { name: "members", type: "array" as const, minRows: 1, maxRows: 50, admin: { isSortable: false, initCollapsed: false } };
    const denied = renderToStaticMarkup(
      <HouseholdMembersField
        path="members"
        field={{ ...baseArrayField, fields: [] }}
        permissions={{ create: true, read: true, update: true, fields: { name: true } }}
      />,
    );
    const deniedApproveAll = denied.match(/<button\b[^>]*>[\s\S]*?<\/button>/g)?.find((button) => button.includes("Godkjenn alle"));
    expect(deniedApproveAll).toMatch(/^<button[^>]*disabled=""/);

    const configuredReadOnly = renderToStaticMarkup(
      <HouseholdMembersField
        path="members"
        field={{
          ...baseArrayField,
          fields: [{ name: "status", type: "select", options: ["pending", "approved", "revoked"], admin: { readOnly: true, isClearable: false, isSortable: false, placeholder: undefined } }],
        }}
      />,
    );
    const readOnlyApproveAll = configuredReadOnly.match(/<button\b[^>]*>[\s\S]*?<\/button>/g)?.find((button) => button.includes("Godkjenn alle"));
    expect(readOnlyApproveAll).toMatch(/^<button[^>]*disabled=""/);
  });

  it("makes reorder controls optional through Payload's isSortable setting", () => {
    const arrayField = { name: "members", type: "array" as const, fields: [], minRows: 1, maxRows: 50 };
    state.rowCount = 2;
    state.memberStatuses = ["pending", "pending"];
    for (const isSortable of [true, false]) {
      const html = renderToStaticMarkup(<HouseholdMembersField path="members" field={{ ...arrayField, admin: { isSortable, initCollapsed: false } }} />);
      expect(html.includes("Flytt familiemedlem")).toBe(isSortable);
      expect(html).toContain("Fjern familiemedlem 1");
      expect(html).toContain("Fjern familiemedlem 2");
      expect(html).toContain("Legg til familiemedlem");
    }
    expect(renderToStaticMarkup(<HouseholdMembersField path="members" field={arrayField} />)).toContain("Flytt familiemedlem");
  });

  it("preserves array limits and locks bulk and native child actions in read-only mode", () => {
    const arrayField = { name: "members", type: "array" as const, fields: [], minRows: 1, maxRows: 50 };
    const readonly = renderToStaticMarkup(<HouseholdMembersField path="members" field={arrayField} readOnly />);
    expect(readonly).toContain('data-readonly="true"');
    expect(readonly.match(/disabled=""/g)).toHaveLength(5); // Approve all, up, down, remove and add.

    state.rowCount = 50;
    state.memberStatuses = Array.from({ length: 50 }, () => "pending");
    const full = renderToStaticMarkup(<HouseholdMembersField path="members" field={arrayField} />);
    const addButton = full.match(/<button\b[^>]*>[\s\S]*?<\/button>/g)?.find((button) => button.includes("Legg til familiemedlem"));
    expect(addButton).toMatch(/^<button[^>]*disabled=""/);
  });
});
