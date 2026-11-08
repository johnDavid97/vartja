import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

export const PUBLICATION_TIMEZONE = "Europe/Oslo";

export function publicationParts(value: Date | string) {
  return {
    day: formatInTimeZone(value, PUBLICATION_TIMEZONE, "yyyy-MM-dd"),
    time: formatInTimeZone(value, PUBLICATION_TIMEZONE, "HH:mm"),
  };
}

/** Preserve the chosen Norwegian wall-clock time, regardless of browser timezone. */
export function publicationISO(day: string, time: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return null;
  const value = fromZonedTime(`${day}T${time}:00`, PUBLICATION_TIMEZONE);
  if (Number.isNaN(value.getTime())) return null;
  const roundTrip = publicationParts(value);
  // Reject nonexistent times during the spring daylight-saving transition.
  return roundTrip.day === day && roundTrip.time === time ? value.toISOString() : null;
}

export function publicationLabel(value: string) {
  return new Intl.DateTimeFormat("nb-NO", {
    timeZone: PUBLICATION_TIMEZONE, day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }).format(new Date(value));
}
