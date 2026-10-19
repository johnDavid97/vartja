"use client";

import { useEffect, useState } from "react";

const MINUTE_MS = 60_000;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;

type WeddingCountdownProps = {
  date: string;
};

export default function WeddingCountdown({ date }: WeddingCountdownProps) {
  const [minutesRemaining, setMinutesRemaining] = useState<number | null>(null);
  const targetTime = Date.parse(date);

  useEffect(() => {
    function updateCountdown() {
      const remaining = Math.ceil((targetTime - Date.now()) / MINUTE_MS);
      setMinutesRemaining(Math.max(0, remaining));
    }

    // Initialize after hydration so server and browser output match.
    const initialUpdate = window.setTimeout(updateCountdown, 0);
    const interval = window.setInterval(updateCountdown, MINUTE_MS);
    window.addEventListener("focus", updateCountdown);

    return () => {
      window.clearTimeout(initialUpdate);
      window.clearInterval(interval);
      window.removeEventListener("focus", updateCountdown);
    };
  }, [targetTime]);

  if (minutesRemaining === null) {
    return <p className="mt-3 text-stone-600">Laster nedtelling…</p>;
  }

  if (minutesRemaining === 0) {
    return <p className="mt-3 text-stone-600">Vi har giftet oss!</p>;
  }

  const totalHours = Math.floor(minutesRemaining / MINUTES_PER_HOUR);
  const days = Math.floor(totalHours / HOURS_PER_DAY);
  const hours = totalHours % HOURS_PER_DAY;
  const minutes = minutesRemaining % MINUTES_PER_HOUR;

  return (
    <p className="mt-3 text-stone-600 tabular-nums font-bold italic">
      {days} d : {String(hours).padStart(2, "0")} h :{" "}
      {String(minutes).padStart(2, "0")} m
    </p>
  );
}
