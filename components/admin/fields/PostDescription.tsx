"use client";

import { useCallback, useId } from "react";
import { FieldError, useField } from "@payloadcms/ui";
import type { TextareaFieldClientComponent, Validate } from "payload";

export const PostDescription: TextareaFieldClientComponent = ({ path, readOnly, field, validate }) => {
  const id = useId();
  const validateField = useCallback<Validate>((value, options) => validate ? validate(value, { ...options, type: "textarea", name: field.name, required: field.required, minLength: field.minLength, maxLength: field.maxLength }) : true, [validate, field.name, field.required, field.minLength, field.maxLength]);
  const { value = "", setValue, disabled, showError } = useField<string>({ path, validate: validateField });
  return (
    <div className="field-type wedding-description">
      <div className="wedding-description__label">
        <label htmlFor={id}>Kort beskrivelse <span className="required">*</span></label>
        <span className={value.length > 160 ? "wedding-description__long" : ""} title="Anbefalt maks 160 tegn">{value.length} / 160</span>
      </div>
      <FieldError path={path} />
      <textarea id={id} name={path} value={value || ""} onChange={(event) => setValue(event.target.value)} disabled={disabled} readOnly={readOnly || field.admin?.readOnly} aria-required="true" aria-invalid={showError} aria-describedby={`${id}-hint`} rows={3} placeholder="Én eller to setninger som vises på innleggskortet" />
      <p id={`${id}-hint`} className="wedding-field-hint">Vises på forsiden, ikke i selve artikkelen.{value.length > 160 && " Tips: Hold beskrivelsen kort, gjerne under 160 tegn."}</p>
    </div>
  );
};
