import { Suspense } from "react";
import { requireApprovedViewer } from "@/features/households/auth/server";
import { withWebsiteAccess } from "@/components/households/withWebsiteAccess";
import { getPayload } from "payload";
import config from "@payload-config";
import { programDayLabel, programError, programLabels, sortedProgram, type ProgramData } from "@/lib/program";

async function PublishedProgram() {
  await requireApprovedViewer();
  const payload = await getPayload({ config });
  // Authorized page read only: the public API still cannot read drafts or versions.
  // Never accept a draft flag from the visitor, and fail closed on status/schema.
  const program = await payload.findGlobal({ slug: "program", draft: false, overrideAccess: true, depth: 0 });
  const data = program._status === "published" && !programError(program.itinerary, true) ? program.itinerary as ProgramData : { days: [] };
  const days = sortedProgram(data);
  if (!days.length) return <p className="text-center text-stone-600">Programmet kommer snart.</p>;
  return <div className="space-y-10">{days.map((day) => <section key={day.id} aria-label={programDayLabel(day)}>
    <h2 className="font-serif text-3xl capitalize">{programDayLabel(day)}</h2>
    <time className="mt-2 block text-stone-600" dateTime={day.date}>{new Intl.DateTimeFormat("nb-NO", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Oslo" }).format(new Date(`${day.date}T12:00:00Z`))}</time>
    <ol className="mt-5 space-y-3">{day.items.map((item) => <li key={item.id} className="rounded-2xl border border-stone-200 bg-white p-5 sm:flex sm:gap-6">
      <div className="mb-2 min-w-20 font-semibold text-emerald-900"><time>{item.time || ""}</time>{item.endTime && <><span> – </span><time>{item.endTime}</time>{item.time && item.endTime < item.time && <span className="block text-xs">neste dag</span>}</>}</div>
      <div className="min-w-0 flex-1 break-words"><span className="text-xs font-semibold uppercase tracking-wide text-stone-500">{programLabels[item.kind]}</span><h3 className="text-xl font-semibold">{item.title}</h3>
        {(item.location || item.destination) && <p className="mt-1 text-stone-600">{[item.location, item.destination].filter(Boolean).join(" → ")}</p>}
        {item.notes && <p className="mt-3 whitespace-pre-wrap text-stone-700">{item.notes}</p>}
      </div>
    </li>)}</ol>
    {!day.items.length && <p className="mt-4 text-stone-600">Detaljer kommer.</p>}
  </section>)}</div>;
}
export default withWebsiteAccess(ProgramPage);
function ProgramPage() {
  return <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6"><h1 className="mb-10 text-center font-serif text-4xl">Program</h1><Suspense fallback={<p>Laster programmet …</p>}><PublishedProgram /></Suspense></main>;
}
