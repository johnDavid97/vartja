import styles from "./welcome.module.css";

export type DashboardSummary = {
  totalHouseholds: number;
  pendingHouseholds: number;
  visiblePosts: number;
};

type SummaryKey = keyof DashboardSummary;

const cards: ReadonlyArray<{
  key: SummaryKey;
  label: string;
  description: string;
}> = [
  {
    key: "totalHouseholds",
    label: "Husstander",
    description: "Registrert totalt",
  },
  {
    key: "pendingHouseholds",
    label: "Til godkjenning",
    description: "Husstander som venter",
  },
  {
    key: "visiblePosts",
    label: "Innlegg",
    description: "Synlige for godkjente gjester",
  },
];

function Count({ value }: { value: number | null }) {
  if (value !== null) return <>{value}</>;

  return (
    <>
      <span aria-hidden="true">—</span>
      <span className={styles.visuallyHidden}>Ikke tilgjengelig</span>
    </>
  );
}

export default function WelcomeView({ summary }: { summary: DashboardSummary | null }) {
  return (
    <section className={styles.welcome} aria-labelledby="welcome-heading">
      <header className={styles.header}>
        <h1 id="welcome-heading">Velkommen</h1>
        <p>Her får dere oversikt over husstander og innlegg.</p>
      </header>

      {summary === null ? (
        <p className={styles.status} role="status">
          Oversikten kunne ikke lastes inn.
        </p>
      ) : null}

      <dl className={styles.cards}>
        {cards.map((card) => {
          const value = summary?.[card.key] ?? null;
          const isPending = card.key === "pendingHouseholds" && value !== null && value > 0;

          return (
            <div className={`${styles.card}${isPending ? ` ${styles.pending}` : ""}`} key={card.key}>
              <dt>{card.label}</dt>
              <dd className={styles.count}>
                <Count value={value} />
              </dd>
              <dd className={styles.description}>{card.description}</dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}
