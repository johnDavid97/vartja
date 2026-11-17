"use client";

import { useId, useState, type ReactNode } from "react";
import { Popover } from "@base-ui/react/popover";
import { DatePicker } from "@payloadcms/ui";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { calendarDate, calendarDay, validCalendarDay } from "@/lib/calendar-date";
import { publicationISO, publicationLabel, publicationParts } from "@/lib/publication-date";
import { AdminButton } from "./AdminButton";

type Props = {
  value: string | null;
  onChange: (value: string | null) => void;
  mode?: "date" | "datetime";
  label: string;
  dialogTitle?: string;
  emptyLabel?: string;
  clearLabel?: string;
  disabled?: boolean;
  fieldError?: ReactNode;
  description?: string;
};

/** Shared calendar UI. Date mode returns YYYY-MM-DD; datetime mode returns an Oslo-based ISO instant. */
export function AdminDatePicker({ value, onChange, mode = "date", label, dialogTitle = "Velg dato", emptyLabel = "Velg dato", clearLabel, disabled, fieldError, description }: Props) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [day, setDay] = useState("");
  const [time, setTime] = useState("12:00");
  const [error, setError] = useState("");
  const dateOnly = mode === "date";
  const changeOpen = (next: boolean) => {
    if (next) {
      const parts = publicationParts(!dateOnly && value ? value : new Date());
      setDay(dateOnly && value && validCalendarDay(value) ? value : parts.day);
      setTime(!dateOnly && value ? parts.time : "12:00");
      setError("");
    }
    setOpen(next);
  };
  function shortcut(offset: number) {
    const today = calendarDate(publicationParts(new Date()).day);
    today.setDate(today.getDate() + offset);
    setDay(calendarDay(today)); setError("");
  }
  const formatted = value ? dateOnly ? validCalendarDay(value) ? new Intl.DateTimeFormat("nb-NO", { day: "numeric", month: "long", year: "numeric" }).format(calendarDate(value)) : emptyLabel : publicationLabel(value) : emptyLabel;
  const shortcuts = dateOnly ? [{ label: "I dag", offset: 0 }, { label: "I morgen", offset: 1 }, { label: "Om en uke", offset: 7 }] : [{ label: "I dag", offset: 0 }, { label: "I går", offset: -1 }, { label: "For en uke siden", offset: -7 }];
  return <div className="field-type wedding-publication-date">
    <label id={`${id}-label`}>{label}</label>
    {fieldError}
    <Popover.Root open={open} onOpenChange={changeOpen}>
      <Popover.Trigger render={<AdminButton variant="plain" />} className="wedding-date-trigger" disabled={disabled} aria-labelledby={`${id}-label ${id}-value`}>
        <CalendarDays size={20} aria-hidden="true" /><span id={`${id}-value`}>{formatted}</span><ChevronDown size={17} aria-hidden="true" />
      </Popover.Trigger>
      <Popover.Portal><Popover.Positioner side="bottom" align="end" sideOffset={10} collisionPadding={16} className="wedding-date-positioner"><Popover.Popup className="wedding-date-popup">
        <Popover.Title className="wedding-sr-only">{dialogTitle}</Popover.Title>
        <div className="wedding-date-shortcuts">{shortcuts.map((item) => <AdminButton key={item.label} variant="secondary" size="sm" shape="pill" onClick={() => shortcut(item.offset)}>{item.label}</AdminButton>)}</div>
        {day && <DatePicker value={calendarDate(day)} pickerAppearance="dayOnly" overrides={{
          inline: true, calendarStartDay: 1,
          ...(dateOnly ? { minDate: calendarDate("1900-01-01"), maxDate: calendarDate("2199-12-31") } : {}),
          onChange: (date: Date | null) => { if (date) { setDay(calendarDay(date)); setError(""); } },
          renderCustomHeader: ({ date, decreaseMonth, increaseMonth, prevMonthButtonDisabled, nextMonthButtonDisabled }) => <div className="wedding-calendar-header">
            <AdminButton variant="ghost" size="icon-sm" aria-label="Forrige måned" disabled={prevMonthButtonDisabled} onClick={decreaseMonth}><ChevronLeft size={20} /></AdminButton>
            <strong aria-live="polite" data-calendar-month={calendarDay(date).slice(0, 7)}>{new Intl.DateTimeFormat("nb-NO", { month: "long", year: "numeric" }).format(date)}</strong>
            <AdminButton variant="ghost" size="icon-sm" aria-label="Neste måned" disabled={nextMonthButtonDisabled} onClick={increaseMonth}><ChevronRight size={20} /></AdminButton>
          </div>,
        }} />}
        {!dateOnly && <div className="wedding-date-time"><label htmlFor={`${id}-time`}>Klokkeslett</label><input id={`${id}-time`} type="time" value={time} onChange={(event) => { setTime(event.target.value); setError(""); }} /></div>}
        {error && <p className="wedding-field-error" role="alert">{error}</p>}
        <div className="wedding-date-actions">
          {clearLabel && <AdminButton variant="ghost" size="sm" className="wedding-date-auto" onClick={() => { onChange(null); setOpen(false); }}>{clearLabel}</AdminButton>}
          <Popover.Close render={<AdminButton variant="secondary" size="sm" />}>Avbryt</Popover.Close>
          <AdminButton size="sm" onClick={() => {
            const next = dateOnly ? validCalendarDay(day) ? day : null : publicationISO(day, time);
            if (!next) { setError(dateOnly ? "Velg en gyldig dato." : "Velg et gyldig klokkeslett. Tiden kan være hoppet over ved overgang til sommertid."); return; }
            onChange(next); setOpen(false);
          }}>Bruk dato</AdminButton>
        </div>
        <p className="wedding-field-hint">{dateOnly ? "Datoen endres først når du velger Bruk dato." : "Norsk tid. Publisering skjer når du trykker Publiser."}</p>
      </Popover.Popup></Popover.Positioner></Popover.Portal>
    </Popover.Root>
    {description && <p className="wedding-field-hint">{description}</p>}
  </div>;
}
