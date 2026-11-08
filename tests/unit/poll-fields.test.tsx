import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@payloadcms/ui", () => ({
  useField: ({ potentiallyStalePath }: { potentiallyStalePath: string }) => ({
    path: potentiallyStalePath, value: "", setValue: vi.fn(), disabled: false, showError: false,
  }),
  FieldError: () => null,
}));

import { PollTextField } from "@/components/admin/editor/PollTextField";

const field = { name: "question", type: "text" as const, label: "Spørsmål", required: true, maxLength: 200 };

describe("poll inputs", () => {
  it("gives repeated block paths unique, associated labels", () => {
    const html = renderToStaticMarkup(<><PollTextField path="question" field={field} /><PollTextField path="question" field={field} /></>);
    const labels = [...html.matchAll(/<label[^>]*for="([^"]+)"/g)].map((match) => match[1]);
    const inputs = [...html.matchAll(/<input[^>]*id="([^"]+)"/g)].map((match) => match[1]);
    expect(labels).toHaveLength(2);
    expect(new Set(inputs).size).toBe(2);
    expect(labels).toEqual(inputs);
  });
  it("numbers answers from the current row path, not a stale server label", () => {
    const html = renderToStaticMarkup(<PollTextField path="options.2.label" field={{ ...field, name: "label", label: "Svar" }} />);
    expect(html).toContain("Svaralternativ 3");
    expect(html).toContain('placeholder="Svaralternativ 3"');
    expect(html).toContain('name="options.2.label"');
  });
  it("honors readonly and length limits without blocking incomplete draft saves via native required", () => {
    const html = renderToStaticMarkup(<PollTextField path="question" field={field} readOnly />);
    expect(html).toContain('disabled=""');
    expect(html).toContain('maxLength="200"');
    expect(html).toContain('aria-required="true"');
    expect(html).not.toContain(' required=""');
  });
});
