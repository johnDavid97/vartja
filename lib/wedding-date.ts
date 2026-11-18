import { validCalendarDay } from "./calendar-date";

/** Date-only values stay calendar dates; timestamps display in the wedding's Oslo timezone. */
export function formatWeddingDate(value: string): string {
  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  if (isDateOnly && !validCalendarDay(value)) return "Dato kommer";
  const date = new Date(isDateOnly ? `${value}T00:00:00Z` : value);
  if (Number.isNaN(date.getTime())) return "Dato kommer";
  return new Intl.DateTimeFormat("nb-NO", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: isDateOnly ? "UTC" : "Europe/Oslo",
  }).format(date);
}
