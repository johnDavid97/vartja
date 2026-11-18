"use client";

import Link from "next/link";
import { useId } from "react";
import { Plus, X } from "lucide-react";
import { AdminButton } from "../AdminButton";
import { PollEditorFrame } from "../editor/PollEditorFrame";
import { MAX_DAY_POLLS, type ProgramDay } from "@/lib/program";
import type { PollDefinition } from "@/lib/polls";

export function ProgramDayActivity({ day, locked, onChange }: { day: ProgramDay; locked: boolean; onChange: (patch: Partial<ProgramDay>) => void }) {
  const id = useId();
  const polls = day.polls ?? [];
  const update = (poll: PollDefinition) => { if (!locked) onChange({ polls: polls.map((candidate) => candidate.id === poll.id ? poll : candidate) }); };
  const moderation = `/admin/collections/program-comments?where[dayId][equals]=${encodeURIComponent(day.id)}`;
  return <section className="program-card" aria-label="Avstemninger og kommentarer for dagen">
    <h2>Avstemninger og kommentarer</h2>
    <p className="program-hint">Gjelder bare denne dagen. Lagre utkast eller publiser øverst som vanlig.</p>
    {polls.map((poll, index) => <div key={poll.id} role="group" aria-label={`Avstemning ${index + 1}`}>
      <PollEditorFrame open={poll.open} editable={!locked}
        onRemove={() => { if (!locked && window.confirm("Fjerne avstemningen fra denne dagen? Eksisterende stemmer beholdes.")) onChange({ polls: polls.filter((candidate) => candidate.id !== poll.id) }); }}
        hint="Én stemme per godkjent husstand. Når noen har stemt, kan du avslutte avstemningen, men ikke endre spørsmål eller svar."
        settings={<label className="program-checkbox"><input type="checkbox" checked={poll.open} disabled={locked} onChange={(event) => update({ ...poll, open: event.target.checked })} /> Åpen for stemmer</label>}>
        <div className="field-type post-poll-block__question">
          <label className="field-label" htmlFor={`${id}-${poll.id}-question`}>Spørsmål</label>
          <input id={`${id}-${poll.id}-question`} value={poll.question} maxLength={200} placeholder="Skriv et spørsmål…" disabled={locked} onChange={(event) => update({ ...poll, question: event.target.value })} />
        </div>
        <div className="post-poll-options" role="group" aria-label="Svaralternativer">
          {poll.options.map((option, optionIndex) => <div className="post-poll-options__row" key={option.id}>
            <div className="field-type">
              <label className="field-label" htmlFor={`${id}-${option.id}`}>Svaralternativ {optionIndex + 1}</label>
              <input id={`${id}-${option.id}`} value={option.label} maxLength={120} placeholder={`Svaralternativ ${optionIndex + 1}`} disabled={locked} onChange={(event) => update({ ...poll, options: poll.options.map((candidate) => candidate.id === option.id ? { ...candidate, label: event.target.value } : candidate) })} />
            </div>
            {poll.options.length > 2 && <AdminButton variant="ghost" size="icon-sm" className="post-poll-options__remove" disabled={locked} aria-label={`Fjern svaralternativ ${optionIndex + 1}`} onClick={() => update({ ...poll, options: poll.options.filter((candidate) => candidate.id !== option.id) })}><X size={16} /></AdminButton>}
          </div>)}
          <AdminButton variant="ghost" className="post-poll-options__add" disabled={locked || poll.options.length >= 10} onClick={() => update({ ...poll, options: [...poll.options, { id: crypto.randomUUID(), label: "" }] })}><Plus size={18} /> Legg til alternativ</AdminButton>
        </div>
      </PollEditorFrame>
    </div>)}
    <AdminButton variant="secondary" disabled={locked || polls.length >= MAX_DAY_POLLS} onClick={() => {
      if (!locked && polls.length < MAX_DAY_POLLS) onChange({ polls: [...polls, { id: crypto.randomUUID(), question: "", options: [{ id: crypto.randomUUID(), label: "" }, { id: crypto.randomUUID(), label: "" }], open: true }] });
    }}><Plus size={17} /> Legg til avstemning</AdminButton>
    <div className="program-day-comments">
      <label className="program-checkbox"><input type="checkbox" checked={day.commentsEnabled !== false} disabled={locked} onChange={(event) => { if (!locked) onChange({ commentsEnabled: event.target.checked }); }} /> Tillat kommentarer denne dagen</label>
      <p className="program-hint">Eksisterende kommentarer vises fortsatt når nye kommentarer stenges. Skjuling og visning i modereringsoversikten gjelder med én gang.</p>
      <Link href={moderation}>Se og moderer dagens kommentarer</Link>
      <p className="program-hint">Svar på kommentarer fra nettsidens Program-side mens du er logget inn som administrator.</p>
    </div>
  </section>;
}
