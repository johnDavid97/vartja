"use client";

import { useCallback } from "react";
import { FieldError, RenderFields, useField, useForm } from "@payloadcms/ui";
import type { ArrayFieldClientComponent, Validate } from "payload";
import { Plus, X } from "lucide-react";
import { AdminButton } from "../AdminButton";

/** Compact inputs backed by Payload's row operations, preserving answer IDs and validation. */
export const PollOptionsField: ArrayFieldClientComponent = ({ field, path: pathFromProps, schemaPath, readOnly, permissions, validate }) => {
  const minRows = field.minRows ?? 2;
  const maxRows = field.maxRows ?? 10;
  const validateRows = useCallback<Validate>((value, options) => validate ? validate(value, {
    ...options, type: "array", name: field.name, fields: [], required: field.required, minRows, maxRows,
  }) : true, [validate, field.name, field.required, minRows, maxRows]);
  const { path, rows = [], disabled } = useField({ hasRows: true, potentiallyStalePath: pathFromProps, validate: validateRows });
  const { addFieldRow, removeFieldRow } = useForm();
  const locked = Boolean(readOnly || field.admin?.readOnly || disabled);
  return (
    <div className="post-poll-options" role="group" aria-label="Svaralternativer">
      <FieldError path={path} />
      {rows.map((row, index) => (
        <div className="post-poll-options__row" key={row.id}>
          <RenderFields
            fields={field.fields}
            forceRender
            parentIndexPath=""
            parentPath={`${path}.${index}`}
            parentSchemaPath={schemaPath ?? field.name}
            permissions={permissions === true ? true : permissions?.fields ?? {}}
            readOnly={locked}
          />
          {rows.length > minRows && <AdminButton variant="ghost" size="icon-sm" className="post-poll-options__remove" disabled={locked} aria-label={`Fjern svaralternativ ${index + 1}`} onClick={() => removeFieldRow({ path, rowIndex: index })}><X size={16} aria-hidden="true" /></AdminButton>}
        </div>
      ))}
      <AdminButton variant="ghost" className="post-poll-options__add" disabled={locked || rows.length >= maxRows} onClick={() => addFieldRow({ path, schemaPath: schemaPath ?? field.name })}>
        <Plus size={18} aria-hidden="true" /> Legg til alternativ
      </AdminButton>
      {rows.length >= maxRows && <p className="post-poll-block__hint">Maks {maxRows} svaralternativer.</p>}
    </div>
  );
};
