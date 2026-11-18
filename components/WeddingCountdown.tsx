"use client";

import { useEffect, useState } from "react";
import {
  calculateWeddingCountdown,
  type WeddingCountdownResult,
} from "@/lib/wedding-countdown";
import styles from "@/components/homepage/hero.module.css";

type WeddingCountdownProps = {
  date: string;
};

const units = [
  ["days", "dager"],
  ["hours", "timer"],
  ["minutes", "minutter"],
  ["seconds", "sekunder"],
] as const;

export default function WeddingCountdown({ date }: WeddingCountdownProps) {
  const [countdown, setCountdown] = useState<WeddingCountdownResult | null>(null);

  useEffect(() => {
    const update = () => setCountdown(calculateWeddingCountdown(date, Date.now()));
    update();
    const interval = window.setInterval(update, 1_000);
    window.addEventListener("focus", update);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", update);
    };
  }, [date]);

  if (countdown?.status === "invalid") {
    return <p className={styles.countdownMessage}>Nedtelling kommer.</p>;
  }

  if (countdown?.status === "elapsed") {
    return <p className={styles.countdownMessage}>Bryllupsdatoen er passert.</p>;
  }

  return (
    <div className={styles.countdown} aria-label="Nedtelling til bryllupet">
      {units.map(([key, label]) => (
        <span className={styles.countdownUnit} key={key}>
          <strong>{countdown ? String(countdown[key]).padStart(key === "days" ? 1 : 2, "0") : "--"}</strong>{" "}
          {label}
        </span>
      ))}
    </div>
  );
}
