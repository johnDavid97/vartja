export type WeddingCountdownResult =
  | { status: "invalid"; days: 0; hours: 0; minutes: 0; seconds: 0; totalSeconds: 0 }
  | { status: "elapsed"; days: 0; hours: 0; minutes: 0; seconds: 0; totalSeconds: 0 }
  | {
      status: "upcoming";
      days: number;
      hours: number;
      minutes: number;
      seconds: number;
      totalSeconds: number;
    };

const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 60 * SECONDS_PER_MINUTE;
const SECONDS_PER_DAY = 24 * SECONDS_PER_HOUR;

/** Calculates display-ready countdown parts without reading the system clock. */
export function calculateWeddingCountdown(
  date: string | number,
  now: number,
): WeddingCountdownResult {
  const target = typeof date === "number" ? date : Date.parse(date);

  if (!Number.isFinite(target) || !Number.isFinite(now)) {
    return { status: "invalid", days: 0, hours: 0, minutes: 0, seconds: 0, totalSeconds: 0 };
  }

  const millisecondsRemaining = target - now;
  if (millisecondsRemaining <= 0) {
    return { status: "elapsed", days: 0, hours: 0, minutes: 0, seconds: 0, totalSeconds: 0 };
  }

  // Ceil keeps the countdown from displaying zero before the target instant.
  const totalSeconds = Math.ceil(millisecondsRemaining / 1_000);
  const days = Math.floor(totalSeconds / SECONDS_PER_DAY);
  const hours = Math.floor((totalSeconds % SECONDS_PER_DAY) / SECONDS_PER_HOUR);
  const minutes = Math.floor((totalSeconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);
  const seconds = totalSeconds % SECONDS_PER_MINUTE;

  return { status: "upcoming", days, hours, minutes, seconds, totalSeconds };
}
