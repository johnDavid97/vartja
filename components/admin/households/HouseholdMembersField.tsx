"use client";

import { useCallback, useId } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { FieldDescription, FieldError, RenderFields, useField, useForm } from "@payloadcms/ui";
import type { ArrayFieldClientComponent, Validate } from "payload";
import { AdminButton } from "@/components/admin/AdminButton";

/** Compact rows using Payload's own field renderer and array operations, not a second form state. */
const HouseholdMembersField: ArrayFieldClientComponent = ({ field, path, schemaPath, permissions, readOnly }) => {
  const headingId = useId();
  const { addFieldRow, removeFieldRow, moveFieldRow } = useForm();
  const minRows = field.minRows ?? 1;
  const maxRows = field.maxRows ?? 50;
  // Payload's array form value is a row count; the bounds come from the collection schema.
  const validateRows = useCallback<Validate>((value) => {
    const count = typeof value === "number" ? value : Array.isArray(value) ? value.length : 0;
    return count >= minRows && count <= maxRows ? true : `Husstanden må ha mellom ${minRows} og ${maxRows} familiemedlemmer.`;
  }, [minRows, maxRows]);
  const { rows = [], path: currentPath, disabled } = useField({ hasRows: true, potentiallyStalePath: path, validate: validateRows });
  const locked = Boolean(readOnly || field.admin?.readOnly || disabled);
  const isSortable = field.admin?.isSortable ?? true;
  const currentSchemaPath = schemaPath ?? field.name;

  return (
    <section className="field-type household-members" aria-labelledby={headingId}>
      <header className="household-members__heading">
        <h2 id={headingId}>Familiemedlemmer</h2>
        <span aria-live="polite">{rows.length} / {maxRows}</span>
      </header>
      <FieldDescription path={currentPath} description={field.admin?.description} />
      <FieldError path={currentPath} />
      <ol className="household-member-rows">
        {rows.map((row, index) => (
          <li key={row.id} className="household-member-row" aria-label={`Familiemedlem ${index + 1}`}>
            <RenderFields
              className="household-member-fields"
              fields={field.fields}
              parentPath={`${currentPath}.${index}`}
              parentSchemaPath={currentSchemaPath}
              parentIndexPath=""
              permissions={permissions === true ? true : permissions?.fields ?? {}}
              readOnly={locked}
              margins={false}
              forceRender
            />
            <div className="household-member-row__actions">
              {isSortable && <>
                <AdminButton variant="ghost" size="icon-sm" aria-label={`Flytt familiemedlem ${index + 1} opp`} title="Flytt opp" disabled={locked || index === 0} onClick={() => moveFieldRow({ path: currentPath, moveFromIndex: index, moveToIndex: index - 1 })}><ArrowUp size={16} aria-hidden="true" /></AdminButton>
                <AdminButton variant="ghost" size="icon-sm" aria-label={`Flytt familiemedlem ${index + 1} ned`} title="Flytt ned" disabled={locked || index === rows.length - 1} onClick={() => moveFieldRow({ path: currentPath, moveFromIndex: index, moveToIndex: index + 1 })}><ArrowDown size={16} aria-hidden="true" /></AdminButton>
              </>}
              <AdminButton variant="ghost" size="icon-sm" aria-label={`Fjern familiemedlem ${index + 1}`} title="Fjern familiemedlem" disabled={locked || rows.length <= minRows} onClick={() => removeFieldRow({ path: currentPath, rowIndex: index })}><Trash2 size={16} aria-hidden="true" /></AdminButton>
            </div>
          </li>
        ))}
      </ol>
      <AdminButton variant="secondary" disabled={locked || rows.length >= maxRows} onClick={() => addFieldRow({ path: currentPath, schemaPath: currentSchemaPath, rowIndex: rows.length })}>
        <Plus size={16} aria-hidden="true" />Legg til Familiemedlem
      </AdminButton>
      <p className="household-members__save-hint">Navn og godkjenning lagres når du trykker «Lagre».</p>
    </section>
  );
};

export default HouseholdMembersField;
