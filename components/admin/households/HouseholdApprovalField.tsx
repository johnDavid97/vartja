"use client";

import { useCallback, useId } from "react";
import { FieldError, useField } from "@payloadcms/ui";
import type { SelectFieldClientComponent, Validate } from "payload";
import { AdminButton } from "@/components/admin/AdminButton";
import { HouseholdStatusBadge } from "./HouseholdStatusBadge";

const HouseholdApprovalField: SelectFieldClientComponent = ({ path, field, readOnly, validate }) => {
  const headingId = useId();
  const validateField = useCallback<Validate>((value, options) => validate
    ? validate(value, { ...options, type: "select", name: field.name, required: field.required, options: field.options, hasMany: false })
    : true, [validate, field.name, field.required, field.options]);
  const { value, setValue, disabled } = useField<string>({ path, validate: validateField });
  const locked = Boolean(readOnly || field.admin?.readOnly || disabled);

  return (
    <section className="household-approval" aria-labelledby={headingId}>
      <h2 id={headingId}>Godkjenning</h2>
      <HouseholdStatusBadge value={value} />
      <p>Velg status for husstanden. Valget lagres når du trykker «Lagre».</p>
      <FieldError path={path} />
      <div className="household-approval__actions" role="group" aria-label="Husstandens status">
        <AdminButton disabled={locked} aria-pressed={value === "approved"} variant={value === "approved" ? "primary" : "secondary"} onClick={() => setValue("approved")}>
          Godkjenn husstanden
        </AdminButton>
        <AdminButton disabled={locked} aria-pressed={value === "revoked"} variant="danger" onClick={() => setValue("revoked")}>
          Avslå husstanden
        </AdminButton>
        <AdminButton disabled={locked} aria-pressed={value === "pending"} variant="ghost" size="sm" onClick={() => setValue("pending")}>
          Sett til venter
        </AdminButton>
      </div>
      <p className="household-approval__hint">Når en ventende husstand godkjennes, godkjennes også familiemedlemmene. Senere tillegg vurderes separat.</p>
    </section>
  );
};

export default HouseholdApprovalField;
