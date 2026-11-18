import { programDayLabel, programLabels, type ProgramDay, type ProgramItem } from "@/lib/program";
import { ProgramKindIcon } from "./ProgramKindIcon";
import styles from "./program.module.css";

function ProgramCard({ item }: { item: ProgramItem }) {
  const transport = item.kind === "bus" || item.kind === "flight" || item.kind === "train";
  const nextDay = Boolean(item.time && item.endTime && item.endTime < item.time);
  return <li className={styles.item} data-kind={item.kind}>
    <div className={styles.departure}>{item.time && <time>{item.time}</time>}</div>
    <span className={styles.marker}><ProgramKindIcon kind={item.kind} /></span>
    <article className={styles.card}>
      <span className={styles.kind}>{programLabels[item.kind]}</span>
      <h3>{item.title}</h3>
      {transport && (item.location || item.destination) ? <div className={styles.route}>
        {item.location && <div className={styles.endpoint}><span>Fra</span><strong>{item.location}</strong></div>}
        {item.location && item.destination && <span className={styles.routeLine}><ProgramKindIcon kind={item.kind} size={17} /></span>}
        {item.destination && <div className={`${styles.endpoint} ${styles.destination}`}><span>Til</span><strong>{item.destination}</strong></div>}
      </div> : item.location || item.destination ? <p className={styles.location}>{[item.location, item.destination].filter(Boolean).join(" → ")}</p> : null}
      {item.endTime && <p className={styles.returnTime}>{transport ? "Retur" : "Slutt"} <time>{item.endTime}</time>{nextDay && <> <span>neste dag</span></>}</p>}
      {item.notes && <p className={styles.notes}>{item.notes}</p>}
    </article>
  </li>;
}

export function ProgramTimeline({ day }: { day: ProgramDay }) {
  return <section aria-label={programDayLabel(day)}>
    <h2 className="sr-only">{programDayLabel(day)}</h2>
    {day.items.length ? <ol className={styles.timeline}>
      {day.items.map((item) => <ProgramCard key={item.id} item={item} />)}
    </ol> : <p className={styles.empty}>Detaljer kommer.</p>}
  </section>;
}
