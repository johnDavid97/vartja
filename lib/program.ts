import { validCalendarDay } from "./calendar-date";
import { parsePoll, type PollDefinition } from "./polls";

export const programKinds = ["flight", "train", "bus", "hotel", "event", "info"] as const;
export type ProgramKind = typeof programKinds[number];
export const programLabels: Record<ProgramKind, string> = { flight: "Fly", train: "Tog", bus: "Buss", hotel: "Hotell", event: "Hendelse", info: "Info" };
export type ProgramItem = { id: string; kind: ProgramKind; title: string; location: string; destination: string; time: string; endTime: string; notes: string };
export type ProgramDay = { id: string; date: string; label: string; items: ProgramItem[]; polls?: PollDefinition[]; commentsEnabled?: boolean };
export const MAX_DAY_POLLS = 10;
export type ProgramData = { days: ProgramDay[] };
export const MAX_PROGRAM_DAYS = 30;
export const MAX_PROGRAM_ITEMS = 100;
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown, max: number): value is string => typeof value === "string" && value.length <= max;
const id = (value: unknown): value is string => typeof value === "string" && /^[a-zA-Z0-9_-]{1,64}$/.test(value);
export const validProgramDate = validCalendarDay;
const validTime = (value: unknown) => typeof value === "string" && (value === "" || /^([01]\d|2[0-3]):[0-5]\d$/.test(value));

/** Runs on the server for drafts AND publication; JSON fields must not trust the custom UI. */
export function programError(value: unknown, publishing = false): string | null {
  if (!record(value) || !Array.isArray(value.days) || value.days.length > MAX_PROGRAM_DAYS) return `Programmet må inneholde inntil ${MAX_PROGRAM_DAYS} dager.`;
  const ids = new Set<string>();
  const dates = new Set<string>();
  for (const day of value.days) {
    if (!record(day) || !id(day.id) || ids.has(day.id)) return "Hver dag og hvert punkt må ha en unik ID.";
    ids.add(day.id);
    if (!text(day.label, 80) || !text(day.date, 10) || (day.date !== "" && !validProgramDate(day.date))) return "Velg en gyldig dato og et kort navn på dagen.";
    if (publishing && !day.date) return "Alle dager må ha en dato før publisering.";
    if (day.date && dates.has(day.date)) return "To dager kan ikke ha samme dato.";
    if (day.date) dates.add(day.date);
    if (day.commentsEnabled !== undefined && typeof day.commentsEnabled !== "boolean") return "Ugyldig kommentarinnstilling.";
    if (day.polls !== undefined) {
      if (!Array.isArray(day.polls) || day.polls.length > MAX_DAY_POLLS) return `En dag kan ha inntil ${MAX_DAY_POLLS} avstemninger.`;
      for (const poll of day.polls) {
        if (!record(poll) || !id(poll.id) || ids.has(poll.id)) return "Hver avstemning må ha en unik ID.";
        ids.add(poll.id);
        if (!text(poll.question, 200) || typeof poll.open !== "boolean" || !Array.isArray(poll.options) || poll.options.length < 2 || poll.options.length > 10) return "Kontroller avstemningen og svaralternativene.";
        const optionIds = new Set<string>();
        for (const option of poll.options) {
          if (!record(option) || !id(option.id) || optionIds.has(option.id) || !text(option.label, 120)) return "Kontroller svaralternativene.";
          optionIds.add(option.id);
        }
        if (publishing && !parsePoll(poll)) return "Hver avstemning trenger et spørsmål og 2–10 forskjellige svaralternativer før publisering.";
      }
    }
    if (!Array.isArray(day.items) || day.items.length > MAX_PROGRAM_ITEMS) return `Hver dag kan ha inntil ${MAX_PROGRAM_ITEMS} punkter.`;
    for (const item of day.items) {
      if (!record(item) || !id(item.id) || ids.has(item.id)) return "Hver dag og hvert punkt må ha en unik ID.";
      ids.add(item.id);
      if (!programKinds.includes(item.kind as ProgramKind) || !text(item.title, 160) || !text(item.location, 200) || !text(item.destination, 200) || !text(item.notes, 4000) || !validTime(item.time) || !validTime(item.endTime)) return "Kontroller tekst, type og klokkeslett i programpunktene.";
      if (publishing && !item.title.trim()) return "Alle punkter må ha en tittel før publisering.";
      if (publishing && item.kind !== "hotel" && item.kind !== "info" && !item.time) return "Transport og hendelser må ha et klokkeslett før publisering.";
    }
  }
  return null;
}
export function programDayLabel(day: ProgramDay) {
  return day.label || (validProgramDate(day.date) ? new Intl.DateTimeFormat("nb-NO", { weekday: "long", timeZone: "Europe/Oslo" }).format(new Date(`${day.date}T12:00:00Z`)) : "Ny dag");
}
export function sortedProgram(data: ProgramData): ProgramDay[] {
  return [...data.days].sort((a, b) => a.date.localeCompare(b.date)).map((day) => ({ ...day, items: [...day.items].sort((a, b) => (a.time || "99:99").localeCompare(b.time || "99:99")) }));
}
export function moveProgramItem(items: ProgramItem[], from: number, to: number) {
  if (from < 0 || to < 0 || from >= items.length || to >= items.length) return items;
  const next = [...items];
  next.splice(to, 0, next.splice(from, 1)[0]);
  return next;
}
