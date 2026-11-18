"use client";

import { useState, type ReactNode } from "react";
import { Tabs } from "@base-ui/react/tabs";
import styles from "./program.module.css";

interface DayPanel {
  id: string;
  date: string;
  dateLabel: string;
  label: string;
  content: ReactNode;
}

/** Keep visited panels mounted so drafts and in-flight retries survive day switches.
 * Unvisited panels stay lazy; published timeline cards are rendered on the server.
 */
export function ProgramDays({ days }: { days: DayPanel[] }) {
  const [visitedDays, setVisitedDays] = useState(() => new Set(days.slice(0, 1).map((day) => day.id)));
  return <Tabs.Root defaultValue={days[0]?.id} onValueChange={(value) => {
    if (typeof value === "string") setVisitedDays((previous) => previous.has(value) ? previous : new Set([...previous, value]));
  }}>
    <Tabs.List aria-label="Velg dag" activateOnFocus className={styles.days}>
      {days.map((day, index) => <Tabs.Tab key={day.id} value={day.id} className={styles.day}>
        <span className={styles.dayNumber}>Dag {index + 1}</span>
        <time dateTime={day.date}>{day.dateLabel}</time>
        {day.label && <span className={styles.dayLabel}>{day.label}</span>}
      </Tabs.Tab>)}
    </Tabs.List>
    {days.map((day) => <Tabs.Panel key={day.id} value={day.id} keepMounted={visitedDays.has(day.id)} className={styles.panel}>
      {day.content}
    </Tabs.Panel>)}
  </Tabs.Root>;
}
