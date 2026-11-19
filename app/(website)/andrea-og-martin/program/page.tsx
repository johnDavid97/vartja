import { Suspense } from "react";
import { requireApprovedViewer } from "@/features/households/auth/server";
import { withWebsiteAccess } from "@/components/households/withWebsiteAccess";
import { ProgramDays } from "@/components/program/ProgramDays";
import { ProgramTimeline } from "@/components/program/ProgramTimeline";
import Poll from "@/components/Poll";
import { Comments } from "@/components/comments/Comments";
import { programError, sortedProgram, type ProgramData } from "@/lib/program";
import styles from "@/components/program/program.module.css";
import { weddingPageMetadata } from "@/features/wedding-site/branding-server";

export async function generateMetadata() { return weddingPageMetadata("Program"); }

const dayFormatter = new Intl.DateTimeFormat("nb-NO", {
  weekday: "short", day: "numeric", month: "long", timeZone: "Europe/Oslo",
});

async function PublishedProgram() {
  const { payload, administrator, household, req } = await requireApprovedViewer();
  const authorName = administrator ? req.user?.name || "Brudeparet" : household!.displayName;
  // Authorized page read only: never accept a visitor-controlled draft flag.
  const program = await payload.findGlobal({ slug: "program", draft: false, overrideAccess: true, depth: 0 });
  const data = program._status === "published" && !programError(program.itinerary, true)
    ? program.itinerary as ProgramData : { days: [] };
  const days = sortedProgram(data);
  if (!days.length) return <p className={styles.empty}>Programmet kommer snart.</p>;
  return <ProgramDays days={days.map((day) => ({
    id: day.id,
    date: day.date,
    dateLabel: dayFormatter.format(new Date(`${day.date}T12:00:00Z`)),
    label: day.label,
    content: <>
      <ProgramTimeline day={day} />
      {day.polls?.map((poll) => <Poll key={poll.id} poll={poll} endpoint={`/api/program-days/${encodeURIComponent(day.id)}/polls/${encodeURIComponent(poll.id)}`} />)}
      <Comments endpoint={`/api/program-days/${encodeURIComponent(day.id)}/comments`} authorName={authorName} administrator={administrator} />
    </>,
  }))} />;
}

export default withWebsiteAccess(ProgramPage);
function ProgramPage() {
  return <main className={styles.page}>
    <header className={styles.intro}>
      <p className={styles.eyebrow}>Reiseplan</p>
      <h1>Programmet</h1>
      <p>Alt som skjer, dag for dag – fra dere lander til dere drar hjem. Sjekk gjerne her igjen rett før avreise.</p>
    </header>
    <Suspense fallback={<p className={styles.empty}>Laster programmet …</p>}><PublishedProgram /></Suspense>
  </main>;
}
