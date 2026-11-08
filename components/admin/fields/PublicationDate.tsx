"use client";

import { useCallback, useId, useState } from "react";
import { Popover } from "@base-ui/react/popover";
import { DatePicker, FieldError, useField } from "@payloadcms/ui";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import type { DateFieldClientComponent, Validate } from "payload";
import { publicationISO, publicationLabel, publicationParts } from "@/lib/publication-date";

function calendarDate(day: string) {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(year, month - 1, date, 12);
}
function calendarDay(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export const PublicationDate: DateFieldClientComponent = ({ path, readOnly, field, validate }) => {
  const id = useId();
  const validateField = useCallback<Validate>((value, options) => validate ? validate(value, { ...options, type: "date", name: field.name, required: field.required }) : true, [validate, field.name, field.required]);
  const { value, setValue, disabled } = useField<string | null>({ path, validate: validateField });
  const [open, setOpen] = useState(false);
  const [day, setDay] = useState("");
  const [time, setTime] = useState("12:00");
  const [error, setError] = useState("");
  const locked = readOnly || field.admin?.readOnly || disabled;
  const changeOpen = (next: boolean) => {
    if (next) {
      const parts = publicationParts(value || new Date());
      setDay(parts.day);
      setTime(value ? parts.time : "12:00");
      setError("");
    }
    setOpen(next);
  };
  function shortcut(daysAgo: number) {
    const today = calendarDate(publicationParts(new Date()).day);
    today.setDate(today.getDate() - daysAgo);
    setDay(calendarDay(today));
    setError("");
  }

  return (
    <div className="field-type wedding-publication-date">
      <label id={`${id}-label`}>Publiseringsdato</label>
      <FieldError path={path} />
      <Popover.Root open={open} onOpenChange={changeOpen}>
        <Popover.Trigger className="wedding-date-trigger" disabled={locked} aria-labelledby={`${id}-label ${id}-value`}>
          <CalendarDays size={20} aria-hidden="true" />
          <span id={`${id}-value`}>{value ? publicationLabel(value) : "Settes ved publisering"}</span>
          <ChevronDown size={17} aria-hidden="true" />
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner side="bottom" align="end" sideOffset={10} collisionPadding={16} className="wedding-date-positioner">
            <Popover.Popup className="wedding-date-popup">
              <Popover.Title className="wedding-sr-only">Velg publiseringsdato</Popover.Title>
              <div className="wedding-date-shortcuts">
                <button type="button" onClick={() => shortcut(0)}>I dag</button>
                <button type="button" onClick={() => shortcut(1)}>I går</button>
                <button type="button" onClick={() => shortcut(7)}>For en uke siden</button>
              </div>
              {day && <DatePicker value={calendarDate(day)} pickerAppearance="dayOnly" overrides={{
                inline: true,
                calendarStartDay: 1,
                onChange: (date: Date | null) => { if (date) { setDay(calendarDay(date)); setError(""); } },
                renderCustomHeader: ({ date, decreaseMonth, increaseMonth }) => (
                  <div className="wedding-calendar-header">
                    <button type="button" aria-label="Forrige måned" onClick={decreaseMonth}><ChevronLeft size={20} /></button>
                    <strong aria-live="polite">{new Intl.DateTimeFormat("nb-NO", { month: "long", year: "numeric" }).format(date)}</strong>
                    <button type="button" aria-label="Neste måned" onClick={increaseMonth}><ChevronRight size={20} /></button>
                  </div>
                ),
              }} />}
              <div className="wedding-date-time">
                <label htmlFor={`${id}-time`}>Klokkeslett</label>
                <input id={`${id}-time`} type="time" value={time} onChange={(event) => { setTime(event.target.value); setError(""); }} />
              </div>
              {error && <p className="wedding-field-error" role="alert">{error}</p>}
              <div className="wedding-date-actions">
                <button type="button" className="wedding-date-auto" onClick={() => { setValue(null); setOpen(false); }}>Sett automatisk</button>
                <Popover.Close className="wedding-button wedding-button--secondary">Avbryt</Popover.Close>
                <button type="button" className="wedding-button" onClick={() => {
                  const iso = publicationISO(day, time);
                  if (!iso) { setError("Velg et gyldig klokkeslett. Tiden kan være hoppet over ved overgang til sommertid."); return; }
                  setValue(iso);
                  setOpen(false);
                }}>Bruk dato</button>
              </div>
              <p className="wedding-field-hint">Norsk tid. Publisering skjer når du trykker Publiser.</p>
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
      <p className="wedding-field-hint">«Sett automatisk» bruker tidspunktet du publiserer.</p>
    </div>
  );
};
