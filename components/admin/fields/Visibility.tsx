"use client";

import { useCallback, useId } from "react";
import { FieldError, useField } from "@payloadcms/ui";
import type { SelectFieldClientComponent, Validate } from "payload";

export const Visibility: SelectFieldClientComponent = ({ path, readOnly, field, validate }) => {
  const id = useId();
  const validateField = useCallback<Validate>((value, options) => validate ? validate(value, { ...options, type: "select", name: field.name, required: field.required, options: field.options, hasMany: false }) : true, [validate, field.name, field.required, field.options]);
  const { value, setValue, disabled } = useField<string>({ path, validate: validateField });
  return (
    <fieldset className="wedding-visibility" disabled={readOnly || field.admin?.readOnly || disabled}>
      <legend>Synlighet</legend>
      <FieldError path={path} />
      {[
        { value: "public", label: "Godkjente gjester", description: "Synlig for godkjente husstander som er logget inn." },
        { value: "private", label: "Privat", description: "Bare innloggede redaktører kan se innlegget i admin." },
      ].map((option) => (
        <label key={option.value} className="wedding-visibility__option">
          <input type="radio" name={id} value={option.value} checked={(value || "public") === option.value} onChange={() => setValue(option.value)} />
          <span><strong>{option.label}</strong><small>{option.description}</small></span>
        </label>
      ))}
      {value === "private" && <p className="wedding-field-hint">Merk: Bilder i mediebiblioteket har fortsatt offentlige lenker.</p>}
    </fieldset>
  );
};
