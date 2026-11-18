import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ProgramTimeline } from "@/components/program/ProgramTimeline";
import { programKinds, programLabels, type ProgramDay, type ProgramItem } from "@/lib/program";

const item: ProgramItem = {
  id: "bus", kind: "bus", title: "Buss til vielsen", location: "Hotellet", destination: "Kirken",
  time: "13:00", endTime: "00:30", notes: "Møt ved hovedinngangen.\nTa med vann.",
};
function render(items: ProgramItem[]) {
  const day: ProgramDay = { id: "wedding", date: "2027-07-27", label: "Bryllupsdagen", items };
  return renderToStaticMarkup(<ProgramTimeline day={day} />);
}

describe("guest Program timeline", () => {
  it("renders transport endpoints, a return time and next-day guidance", () => {
    const html = render([item]);
    for (const content of ["Fra", "Hotellet", "Til", "Kirken", "Retur", "00:30", "neste dag", item.notes]) {
      expect(html).toContain(content);
    }
    expect(html).toContain('aria-label="Bryllupsdagen"');
  });

  it.each(programKinds)("supports %s cards without inventing missing fields", (kind) => {
    const html = render([{ ...item, kind, time: "", endTime: "", location: "", destination: "", notes: "" }]);
    expect(html).toContain(programLabels[kind]);
    expect(html).not.toContain("Retur");
    expect(html).not.toContain("neste dag");
    expect(html).not.toContain("undefined");
  });

  it("labels event end times as Slutt, not Retur", () => {
    const html = render([{ ...item, kind: "event", endTime: "14:00" }]);
    expect(html).toContain("Slutt");
    expect(html).not.toContain("Retur");
    expect(html).not.toContain("neste dag");
  });

  it("escapes content and handles an empty day", () => {
    expect(render([{ ...item, title: "<script>test</script>" }])).toContain("&lt;script&gt;");
    expect(render([])).toContain("Detaljer kommer.");
  });
});
