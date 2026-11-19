"use client";

import { useCallback, useId } from "react";
import { ArrowDown, ArrowUp, Check, Plus, Trash2 } from "lucide-react";
import { FieldDescription, FieldError, RenderFields, useField, useForm, useFormFields } from "@payloadcms/ui";
import type { ArrayFieldClientComponent, Validate } from "payload";
import { AdminButton } from "@/components/admin/AdminButton";
import { memberInitials } from "@/lib/household-admin-presentation";
import { memberFieldsSignature, membersFromSignature } from "./householdFormPresentation";

/** Compact rows using Payload's own field renderer and array operations, not a second form state. */
const HouseholdMembersField: ArrayFieldClientComponent = ({ field, path, schemaPath, permissions, readOnly }) => {
  const headingId = useId();
  const { addFieldRow, dispatchFields, removeFieldRow, moveFieldRow, setModified } = useForm();
  const memberSignature = useFormFields(([fields]) => memberFieldsSignature(fields));
  const liveMembers = membersFromSignature(memberSignature);
  const minRows = field.minRows ?? 1;
  const maxRows = field.maxRows ?? 50;
  const validateRows = useCallback<Validate>((value) => {
    const count = typeof value === "number" ? value : Array.isArray(value) ? value.length : 0;
    return count >= minRows && count <= maxRows ? true : `Husstanden må ha mellom ${minRows} og ${maxRows} familiemedlemmer.`;
  }, [minRows, maxRows]);
  const { rows = [], path: currentPath, disabled } = useField({ hasRows: true, potentiallyStalePath: path, validate: validateRows });
  const locked = Boolean(readOnly || field.admin?.readOnly || disabled);
  const isSortable = field.admin?.isSortable ?? true;
  const currentSchemaPath = schemaPath ?? field.name;
  const approvedCount = liveMembers.filter((member) => member.status === "approved").length;
  const fieldsPermissions = permissions === true ? true : permissions?.fields;
  const statusPermissions = fieldsPermissions === true ? true : fieldsPermissions?.status;
  const canUpdateStatus = permissions === undefined
    || permissions === true
    || statusPermissions === true
    || statusPermissions?.update === true;
  const statusField = field.fields.find((memberField) => "name" in memberField && memberField.name === "status");
  const statusConfiguredReadOnly = Boolean(statusField?.admin?.readOnly);
  const statusLocked = locked || statusConfiguredReadOnly || !canUpdateStatus;
  const allApproved = rows.length > 0 && approvedCount === rows.length;

  function approveAllMembers() {
    if (statusLocked || allApproved) return;
    let changed = false;
    for (let index = 0; index < rows.length; index += 1) {
      const member = liveMembers.find((candidate) => candidate.index === index);
      if (member?.status === "approved") continue;
      dispatchFields({ type: "UPDATE", path: `${currentPath}.${index}.status`, value: "approved" });
      changed = true;
    }
    if (changed) setModified(true);
  }

  return (
    <section className="field-type household-members" aria-labelledby={headingId}>
      <header className="household-members__heading">
        <div className="household-members__title">
          <h2 id={headingId}>Familiemedlemmer</h2>
          <span aria-live="polite">{approvedCount} av {rows.length} godkjent</span>
        </div>
        <AdminButton variant="secondary" disabled={statusLocked || allApproved} onClick={approveAllMembers}>
          <Check size={16} aria-hidden="true" />Godkjenn alle
        </AdminButton>
      </header>
      <FieldDescription path={currentPath} description={field.admin?.description} />
      <FieldError path={currentPath} />
      <ol className="household-member-rows">
        {rows.map((row, index) => {
          const member = liveMembers.find((candidate) => candidate.index === index);
          return (
            <li key={row.id} className="household-member-row" aria-label={`Familiemedlem ${index + 1}`}>
              <span className={`household-member-avatar household-member-avatar--${index % 3}`} aria-hidden="true">
                {memberInitials(member?.name ?? "")}
              </span>
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
          );
        })}
      </ol>
      <AdminButton className="household-members__add" variant="ghost" disabled={locked || rows.length >= maxRows} onClick={() => addFieldRow({ path: currentPath, schemaPath: currentSchemaPath, rowIndex: rows.length })}>
        <Plus size={16} aria-hidden="true" />Legg til familiemedlem
      </AdminButton>
      <p className="household-members__save-hint">Endringene lagres først når du trykker «Lagre».</p>
    </section>
  );
};

export default HouseholdMembersField;
