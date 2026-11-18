import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ value: "#123456" }));
vi.mock("@payloadcms/ui", () => ({
  useField: () => ({ value: state.value, setValue: vi.fn(), disabled: false, showError: false }),
  useTranslation: () => ({ i18n: { language: "nb", fallbackLanguage: "nb" } }),
  FieldError: () => null,
  FieldLabel: ({ htmlFor, label }: { htmlFor: string; label: string }) => <label htmlFor={htmlFor}>{label}</label>,
  FieldDescription: ({ description }: { description: string }) => <p>{description}</p>,
}));

import { ColorField } from "../../components/admin/fields/ColorField";
const field = { name: "buttonColor", type: "text" as const, label: "Knappfarge" };

beforeEach(() => { state.value = "#123456"; });

describe("reusable colour field markup", () => {
  it("uses configured labels and help rather than homepage-specific copy", () => {
    const html = renderToStaticMarkup(<ColorField path="buttonColor" field={{ ...field, admin: { description: "Fargen på knappen." } }} />);
    expect(html).toContain("Velg farge: Knappfarge");
    expect(html).toContain("Fargen på knappen.");
    expect(html).not.toContain("reserve hvis et bilde mangler");
    expect(html).toContain("aria-describedby=");
  });
  it("does not attach a nonexistent description and respects readonly", () => {
    const html = renderToStaticMarkup(<ColorField path="buttonColor" field={field} readOnly />);
    expect(html).not.toContain("aria-describedby=");
    expect(html.match(/disabled=""/g)).toHaveLength(2);
  });
  it("keeps invalid input editable while supplying a valid native picker fallback", () => {
    state.value = "invalid";
    const html = renderToStaticMarkup(<ColorField path="buttonColor" field={field} />);
    expect(html).toContain('value="#000000"');
    expect(html).toContain('value="invalid"');
  });
});
