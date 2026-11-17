"use client";

import { useId, useRef, useState } from "react";
import { FieldError, useField } from "@payloadcms/ui";
import type { JSONFieldClientComponent } from "payload";
import { ArrowDown, ArrowUp, BedDouble, Bus, GripVertical, Heart, Info, Plane, Plus, TrainFront } from "lucide-react";
import { AdminButton } from "../AdminButton";
import { AdminDatePicker } from "../AdminDatePicker";
import { MAX_PROGRAM_DAYS, MAX_PROGRAM_ITEMS, moveProgramItem, programDayLabel, programKinds, programLabels, type ProgramData, type ProgramDay, type ProgramItem, type ProgramKind } from "@/lib/program";

const icons = { flight: Plane, train: TrainFront, bus: Bus, hotel: BedDouble, event: Heart, info: Info };
const MIME = "application/x-sammen-program-item";
function KindIcon({ kind }: { kind: ProgramKind }) {
  const Icon = icons[kind];
  return <span className={`program-icon program-icon--${kind}`}><Icon size={21} aria-hidden="true" /></span>;
}

const ProgramBuilder: JSONFieldClientComponent = ({ path, readOnly, field }) => {
  const { value, setValue, disabled } = useField<ProgramData>({ path });
  const days = value?.days ?? [];
  const locked = Boolean(readOnly || field.admin?.readOnly || disabled);
  const [dayId, setDayId] = useState<string | null>(null);
  const [itemId, setItemId] = useState<string | null>(null);
  const day = days.find((candidate) => candidate.id === dayId) ?? days[0];
  const item = day?.items.find((candidate) => candidate.id === itemId);
  const id = useId();
  const panel = useRef<HTMLHeadingElement>(null);
  const commit = (next: ProgramDay[]) => { if (!locked) setValue({ days: next }); };
  const updateDay = (patch: Partial<ProgramDay>) => { if (day) commit(days.map((candidate) => candidate.id === day.id ? { ...candidate, ...patch } : candidate)); };
  const updateItem = (patch: Partial<ProgramItem>) => { if (day && item) updateDay({ items: day.items.map((candidate) => candidate.id === item.id ? { ...candidate, ...patch } : candidate) }); };
  const selectItem = (next: string) => { setItemId(next); requestAnimationFrame(() => panel.current?.focus()); };
  function addDay() {
    if (locked || days.length >= MAX_PROGRAM_DAYS) return;
    const next: ProgramDay = { id: crypto.randomUUID(), date: "", label: "", items: [] };
    commit([...days, next]); setDayId(next.id); setItemId(null);
  }
  function addItem(kind: ProgramKind) {
    if (!day || locked || day.items.length >= MAX_PROGRAM_ITEMS) return;
    const next: ProgramItem = { id: crypto.randomUUID(), kind, title: programLabels[kind], location: "", destination: "", time: "", endTime: "", notes: "" };
    updateDay({ items: [...day.items, next] }); selectItem(next.id);
  }
  function move(from: number, to: number) { if (day && !locked) updateDay({ items: moveProgramItem(day.items, from, to) }); }
  const transport = item && ["bus", "train", "flight"].includes(item.kind);
  return <section className="program-builder" aria-label="Programbygger">
    <FieldError path={path} />
    <div className="program-days" aria-label="Dager">
      {days.map((candidate) => <AdminButton key={candidate.id} variant={candidate.id === day?.id ? "secondary" : "ghost"} aria-pressed={candidate.id === day?.id} onClick={() => { setDayId(candidate.id); setItemId(null); }}><span>{programDayLabel(candidate)}</span><span className="program-days__count">{candidate.items.length}</span></AdminButton>)}
      <AdminButton variant="ghost" disabled={locked || days.length >= MAX_PROGRAM_DAYS} onClick={addDay}><Plus size={17} /> Ny dag</AdminButton>
    </div>
    {!day ? <div className="program-card program-empty"><h2>Planlegg bryllupsdagene</h2><p>Legg til en dag for å starte. Ingen eksempelpunkter blir publisert.</p></div> : <>
      <div className="program-day-settings program-card">
        <AdminDatePicker key={day.id} label="Dato" value={day.date || null} onChange={(date) => updateDay({ date: date ?? "" })} disabled={locked} clearLabel="Tøm dato" />
        <label htmlFor={`${id}-day-label`}>Navn på dagen (valgfritt)<input id={`${id}-day-label`} value={day.label} maxLength={80} placeholder="F.eks. Velkomstkveld" disabled={locked} onChange={(event) => updateDay({ label: event.target.value })} /></label>
        <AdminButton variant="ghost" disabled={locked} onClick={() => { if (window.confirm(`Slette ${programDayLabel(day)} og alle punktene denne dagen?`)) { commit(days.filter((candidate) => candidate.id !== day.id)); setItemId(null); } }}>Slett dag</AdminButton>
      </div>
      <div className="program-layout">
        <div className="program-main">
          <div className="program-card program-palette"><h2>Legg til i programmet</h2><div>{programKinds.map((kind) => <AdminButton key={kind} variant="plain" className="program-palette__item" disabled={locked || day.items.length >= MAX_PROGRAM_ITEMS} onClick={() => addItem(kind)}><KindIcon kind={kind} /><strong>{programLabels[kind]}</strong></AdminButton>)}</div></div>
          <ol className="program-items" aria-label="Programpunkter">
            {day.items.map((entry, index) => <li key={entry.id} className={`program-item${entry.id === item?.id ? " program-item--selected" : ""}`} onDragOver={(event) => { if (!locked && event.dataTransfer.types.includes(MIME)) event.preventDefault(); }} onDrop={(event) => { if (locked) return; const from = day.items.findIndex((candidate) => candidate.id === event.dataTransfer.getData(MIME)); if (from >= 0) { event.preventDefault(); move(from, index); } }}>
              <AdminButton variant="ghost" size="icon-sm" draggable={!locked} disabled={locked} aria-label={`Dra ${entry.title || "punkt"}`} onDragStart={(event) => { event.dataTransfer.setData(MIME, entry.id); event.dataTransfer.effectAllowed = "move"; }}><GripVertical size={16} /></AdminButton>
              <AdminButton variant="plain" className="program-item__select" aria-pressed={entry.id === item?.id} onClick={() => selectItem(entry.id)}>
                <time>{entry.time || "—"}</time><KindIcon kind={entry.kind} /><span><strong>{entry.title || "Uten tittel"}</strong><small>{[programLabels[entry.kind], entry.location, entry.destination].filter(Boolean).join(" · ")}</small></span>
              </AdminButton>
              <div className="program-item__order"><AdminButton variant="ghost" size="icon-sm" disabled={locked || index === 0} aria-label={`Flytt ${entry.title || "punkt"} opp`} onClick={() => move(index, index - 1)}><ArrowUp size={15} /></AdminButton><AdminButton variant="ghost" size="icon-sm" disabled={locked || index === day.items.length - 1} aria-label={`Flytt ${entry.title || "punkt"} ned`} onClick={() => move(index, index + 1)}><ArrowDown size={15} /></AdminButton></div>
            </li>)}
          </ol>
          {day.items.length === 0 && <p className="program-hint">Ingen punkter ennå. Velg en type ovenfor.</p>}
          <p className="program-hint">Dra i håndtaket eller bruk pilene for å endre rekkefølge. På nettsiden sorteres dagene etter dato og punktene etter klokkeslett. Punkter uten tid vises sist.</p>
          <p className="program-hint">Endringene lagres først når du velger «Lagre utkast» eller «Publiser» øverst.</p>
        </div>
        {item ? <aside className="program-card program-item-editor" aria-label="Rediger programpunkt">
          <header><KindIcon kind={item.kind} /><div><small>{programLabels[item.kind]}</small><h2 ref={panel} tabIndex={-1}>{item.title || "Nytt punkt"}</h2></div></header>
          <label htmlFor={`${id}-title`}>Tittel<input id={`${id}-title`} value={item.title} maxLength={160} disabled={locked} onChange={(event) => updateItem({ title: event.target.value })} /></label>
          <div className="program-input-row">
            <label htmlFor={`${id}-location`}>{transport ? "Hentested / fra" : "Sted"}<input id={`${id}-location`} value={item.location} maxLength={200} disabled={locked} onChange={(event) => updateItem({ location: event.target.value })} /></label>
            {transport && <label htmlFor={`${id}-destination`}>Til<input id={`${id}-destination`} value={item.destination} maxLength={200} disabled={locked} onChange={(event) => updateItem({ destination: event.target.value })} /></label>}
          </div>
          <div className="program-input-row">
            <label htmlFor={`${id}-time`}>{transport ? "Avgang" : "Klokkeslett"}<input id={`${id}-time`} type="time" value={item.time} disabled={locked} onChange={(event) => updateItem({ time: event.target.value })} /></label>
            <label htmlFor={`${id}-end`}>{transport ? "Retur (valgfritt)" : "Slutt (valgfritt)"}<input id={`${id}-end`} type="time" value={item.endTime} disabled={locked} onChange={(event) => updateItem({ endTime: event.target.value })} /></label>
          </div>
          <p className="program-hint">Alle tider er lokale. Slutt/retur tidligere enn start gjelder neste dag.</p>
          <label htmlFor={`${id}-notes`}>Info til gjestene (valgfritt)<textarea id={`${id}-notes`} value={item.notes} maxLength={4000} rows={4} disabled={locked} onChange={(event) => updateItem({ notes: event.target.value })} /></label>
          <footer><AdminButton variant="ghost" disabled={locked} onClick={() => { if (window.confirm("Slette dette programpunktet?")) { updateDay({ items: day.items.filter((candidate) => candidate.id !== item.id) }); setItemId(null); } }}>Slett punkt</AdminButton><AdminButton onClick={() => setItemId(null)}>Ferdig</AdminButton></footer>
        </aside> : <aside className="program-card program-empty"><h2>Detaljer</h2><p>Velg et punkt for å redigere det.</p></aside>}
      </div>
    </>}
  </section>;
};
export default ProgramBuilder;
