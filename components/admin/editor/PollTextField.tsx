"use client";

import { useCallback, useId } from "react";
import { FieldError, useField } from "@payloadcms/ui";
import type { TextFieldClientComponent, Validate } from "payload";

/** Block-local paths repeat across polls; useId keeps every label/input association unique. */
export const PollTextField: TextFieldClientComponent = ({ field, path: pathFromProps, readOnly, validate }) => {
  const id = useId();
  const validateText = useCallback<Validate>((value, options) => validate ? validate(value, {
    ...options, type: "text", name: field.name, required: field.required,
    minLength: field.minLength, maxLength: field.maxLength, hasMany: false,
  }) : true, [validate, field.name, field.required, field.minLength, field.maxLength]);
  const { path, value, setValue, disabled, showError } = useField<string>({ potentiallyStalePath: pathFromProps, validate: validateText });
  const answerIndex = path.match(/(?:^|\.)options\.(\d+)\.label$/)?.[1];
  const label = answerIndex !== undefined ? `Svaralternativ ${Number(answerIndex) + 1}` : typeof field.label === "string" ? field.label : field.name;
  const placeholder = answerIndex !== undefined ? label : typeof field.admin?.placeholder === "string" ? field.admin.placeholder : undefined;
  return (
    <div className={`field-type text post-poll-text ${field.admin?.className ?? ""}`}>
      <label className="field-label" htmlFor={id}>{label}</label>
      <input
        id={id} name={path} type="text" value={value ?? ""} placeholder={placeholder}
        maxLength={field.maxLength} aria-required={field.required} aria-invalid={showError || undefined}
        aria-describedby={showError ? `${id}-error` : undefined}
        disabled={readOnly || field.admin?.readOnly || disabled}
        onChange={(event) => setValue(event.target.value)}
      />
      <div id={`${id}-error`}><FieldError path={path} /></div>
    </div>
  );
};
