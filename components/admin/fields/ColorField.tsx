"use client";

import { useCallback, useId } from "react";
import { FieldError, FieldLabel, useField } from "@payloadcms/ui";
import type { TextFieldClientComponent, Validate } from "payload";
import styles from "./color-field.module.css";

/** Native colour chooser paired with an editable, validated hex value. */
export const ColorField: TextFieldClientComponent = ({ path, field, readOnly, validate }) => {
  const id = useId();
  const validateField = useCallback<Validate>((value, options) => validate
    ? validate(value, { ...options, type: "text", name: field.name, required: field.required }) : true,
  [validate, field.name, field.required]);
  const { value, setValue, disabled, showError } = useField<string>({ path, validate: validateField });
  const locked = Boolean(readOnly || field.admin?.readOnly || disabled);
  const swatchColor = /^#[0-9a-f]{6}$/i.test(value || "") ? value : "#000000";

  return (
    <div className="field-type text">
      <FieldLabel htmlFor={id} label={field.label} required={field.required} />
      <FieldError path={path} />
      <div className={styles.controls}>
        <input className={styles.swatch} type="color" value={swatchColor} disabled={locked} aria-label="Velg bakgrunnsfarge" onChange={(event) => setValue(event.target.value)} />
        <input id={id} className={styles.hex} type="text" value={value || ""} disabled={locked} aria-invalid={showError || undefined} aria-describedby={`${id}-help`} maxLength={7} spellCheck={false} autoCapitalize="off" onChange={(event) => setValue(event.target.value)} />
      </div>
      <p id={`${id}-help`} className="field-description">Brukes ved fargevalg, og som reserve hvis et bilde mangler.</p>
    </div>
  );
};
