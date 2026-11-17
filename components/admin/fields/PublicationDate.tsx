"use client";

import { useCallback } from "react";
import { FieldError, useField } from "@payloadcms/ui";
import type { DateFieldClientComponent, Validate } from "payload";
import { AdminDatePicker } from "../AdminDatePicker";

export const PublicationDate: DateFieldClientComponent = ({ path, readOnly, field, validate }) => {
  const validateField = useCallback<Validate>((value, options) => validate ? validate(value, { ...options, type: "date", name: field.name, required: field.required }) : true, [validate, field.name, field.required]);
  const { value, setValue, disabled } = useField<string | null>({ path, validate: validateField });
  return <AdminDatePicker
    mode="datetime" value={value} onChange={setValue}
    label="Publiseringsdato" dialogTitle="Velg publiseringsdato"
    emptyLabel="Settes ved publisering" clearLabel="Sett automatisk"
    disabled={readOnly || field.admin?.readOnly || disabled}
    fieldError={<FieldError path={path} />}
    description="«Sett automatisk» bruker tidspunktet du publiserer."
  />;
};
