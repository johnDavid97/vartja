import { describe, expect, it } from "vitest";
import { moveProgramItem, programDayLabel, programError, sortedProgram, validProgramDate, type ProgramData, type ProgramItem } from "@/lib/program";

const item: ProgramItem = { id: "item-1", kind: "bus", title: "Buss", location: "Hotell", destination: "Kirke", time: "13:00", endTime: "00:30", notes: "" };
const fixture = (): ProgramData => ({ days: [{ id: "day-1", date: "2027-07-27", label: "", items: [{ ...item }] }] });
describe("program", () => {
  it("accepts a complete itinerary and an intentional empty program", () => {
    expect(programError(fixture(), true)).toBeNull();
    expect(programError({ days: [] }, true)).toBeNull();
  });
  it("allows incomplete drafts but not incomplete publication", () => {
    const data = fixture(); data.days[0].date = "";
    expect(programError(data)).toBeNull(); expect(programError(data, true)).toBeTruthy();
    data.days[0].date = "2027-07-27"; data.days[0].items[0].time = "";
    expect(programError(data)).toBeNull(); expect(programError(data, true)).toBeTruthy();
    data.days[0].items[0].kind = "info";
    expect(programError(data, true)).toBeNull();
  });
  it("rejects invalid dates, times, duplicate dates and IDs", () => {
    expect(validProgramDate("2027-02-29")).toBe(false);
    expect(validProgramDate("2028-02-29")).toBe(true);
    expect(validProgramDate("2027-13-01")).toBe(false);
    const data = fixture(); data.days[0].items[0].time = "25:00";
    expect(programError(data)).toBeTruthy();
    data.days[0].items[0].time = "13:00";
    data.days.push({ ...data.days[0], id: "day-2", items: [] });
    expect(programError(data)).toContain("samme dato");
    data.days.pop(); data.days[0].items[0].id = "day-1";
    expect(programError(data)).toContain("unik ID");
  });
  it("bounds and validates untrusted JSON, including drafts", () => {
    for (const value of [null, [], { days: "bad" }, { days: Array(31).fill({}) }, { days: [null] }]) expect(programError(value)).toBeTruthy();
    const data = fixture(); data.days[0].items[0].notes = "a".repeat(4001);
    expect(programError(data)).toBeTruthy();
    expect(programError({ days: [{ ...fixture().days[0], items: [{ ...item, kind: "script" }] }] })).toBeTruthy();
  });
  it("sorts public days and times without mutating editorial order", () => {
    const data = fixture(); data.days[0].items.push({ ...item, id: "earlier", time: "12:00" }, { ...item, id: "untimed", kind: "info", time: "" }, { ...item, id: "same-time" });
    data.days.push({ id: "previous", date: "2027-07-26", label: "", items: [] });
    const sorted = sortedProgram(data);
    expect(sorted[0].id).toBe("previous");
    expect(sorted[1].items.map(({ id }) => id)).toEqual(["earlier", "item-1", "same-time", "untimed"]);
    expect(data.days[0].items[0].id).toBe("item-1");
  });
  it("moves items without replacing their IDs", () => {
    const items = [{ ...item }, { ...item, id: "second" }];
    expect(moveProgramItem(items, 0, 1).map(({ id }) => id)).toEqual(["second", "item-1"]);
    expect(items[0].id).toBe("item-1");
    expect(moveProgramItem(items, 0, -1)).toBe(items);
  });
  it("uses real day names, optional labels and a clear undated label", () => {
    expect(programDayLabel(fixture().days[0])).toBe("tirsdag");
    expect(programDayLabel({ ...fixture().days[0], label: "Velkomst" })).toBe("Velkomst");
    expect(programDayLabel({ ...fixture().days[0], date: "" })).toBe("Ny dag");
  });
});
