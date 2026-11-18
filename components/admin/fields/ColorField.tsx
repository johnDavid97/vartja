"use client";

import { useCallback, useId } from "react";
import { FieldDescription, FieldError, FieldLabel, useField, useTranslation } from "@payloadcms/ui";
import { getTranslation } from "@payloadcms/translations";
import type { TextFieldClientComponent, Validate } from "payload";
import { isHexColor } from "@/lib/colors";
import styles from "./color-field.module.css";

/** Native colour chooser paired with an editable, validated hex value. */
export const ColorField: TextFieldClientComponent = ({ path, field, readOnly, validate }) => {
  const id = useId();
  const { i18n } = useTranslation();
  const label = getTranslation(field.label || field.name, i18n);
  const description = field.admin?.description;
  const validateField = useCallback<Validate>(
    (value, options) => validate
      ? validate(value, { ...options, type: "text", name: field.name, required: field.required })
      : true,
    [validate, field.name, field.required],
  );
  const { value, setValue, disabled, showError } = useField<string>({ path, validate: validateField });
  const locked = Boolean(readOnly || field.admin?.readOnly || disabled);
  const swatchColor = isHexColor(value) ? value : "#000000";

  return (
    <div className="field-type text">
      <FieldLabel htmlFor={id} label={field.label} required={field.required} />
      <FieldError path={path} />
      <div className={styles.controls}>
        <input
          className={styles.swatch}
          type="color"
          value={swatchColor}
          disabled={locked}
          aria-label={`Velg farge: ${label}`}
          onChange={(event) => setValue(event.target.value)}
        />
        <input
          id={id}
          className={styles.hex}
          type="text"
          value={value || ""}
          disabled={locked}
          aria-invalid={showError || undefined}
          aria-describedby={description ? `${id}-help` : undefined}
          maxLength={7}
          spellCheck={false}
          autoCapitalize="off"
          onChange={(event) => setValue(event.target.value)}
        />
      </div>
      {description && (
        <div id={`${id}-help`}>
          <FieldDescription path={path} description={description} />
        </div>
      )}
    </div>
  );
};
