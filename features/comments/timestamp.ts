const MINUTE_IN_MILLISECONDS = 60_000;
const HOUR_IN_MILLISECONDS = 60 * MINUTE_IN_MILLISECONDS;
const DAY_IN_MILLISECONDS = 24 * HOUR_IN_MILLISECONDS;

/** Formats a compact comment age against an explicit clock for deterministic rendering and tests. */
export function formatCommentAge(createdAt: string | Date, now: Date): string {
  const elapsed = Math.max(0, now.getTime() - new Date(createdAt).getTime());

  if (elapsed < MINUTE_IN_MILLISECONDS) return "nå";
  if (elapsed < HOUR_IN_MILLISECONDS) return `${Math.floor(elapsed / MINUTE_IN_MILLISECONDS)} min`;
  if (elapsed < DAY_IN_MILLISECONDS) return `${Math.floor(elapsed / HOUR_IN_MILLISECONDS)} t`;
  return `${Math.floor(elapsed / DAY_IN_MILLISECONDS)} d`;
}
