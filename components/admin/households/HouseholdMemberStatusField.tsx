"use client";

import { useCallback, useId } from "react";
import { FieldError, useField } from "@payloadcms/ui";
import type { SelectFieldClientComponent, Validate } from "payload";

/** Native radios presented as a compact segmented toggle. Changes stay in the document form. */
const HouseholdMemberStatusField: SelectFieldClientComponent = ({ path, field, readOnly, validate }) => {
  const id = useId();
  const validateField = useCallback<Validate>((value, options) => validate
    ? validate(value, { ...options, type: "select", name: field.name, required: field.required, options: field.options, hasMany: false })
    : true, [validate, field.name, field.required, field.options]);
  const { value, setValue, disabled, path: currentPath } = useField<string>({ potentiallyStalePath: path, validate: validateField });
  return (
    <fieldset className="household-member-status" disabled={Boolean(readOnly || field.admin?.readOnly || disabled)}>
      <legend>Godkjenning</legend>
      <div className="household-member-status__options">
        {[
          { value: "pending", label: "Venter" },
          { value: "approved", label: "Godkjent" },
          { value: "revoked", label: "Avslått" },
        ].map((option) => (
          <label key={option.value} className={`household-member-status__option household-member-status__option--${option.value}`}>
            <input type="radio" name={id} value={option.value} checked={value === option.value} onChange={() => setValue(option.value)} />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
      <FieldError path={currentPath} />
    </fieldset>
  );
};

export default HouseholdMemberStatusField;
