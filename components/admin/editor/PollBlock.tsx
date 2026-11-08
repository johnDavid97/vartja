"use client";

import { RenderFields, useFormFields } from "@payloadcms/ui";
import { useBlockComponentContext } from "@payloadcms/richtext-lexical/client";
import { $getNodeByKey } from "@payloadcms/richtext-lexical/lexical";
import { useLexicalEditable } from "@payloadcms/richtext-lexical/lexical/react/useLexicalEditable";
import { useLexicalComposerContext } from "@payloadcms/richtext-lexical/lexical/react/LexicalComposerContext";
import { ChartNoAxesColumn, Settings2, X } from "lucide-react";
import { AdminButton, adminButtonStyles } from "../AdminButton";

export function PollBlock() {
  const { formSchema, nodeKey } = useBlockComponentContext();
  const [editor] = useLexicalComposerContext();
  const editable = useLexicalEditable();
  const open = useFormFields(([fields]) => fields.open?.value);
  const fields = formSchema.filter((field) => !("name" in field) || field.name !== "open");
  const settings = formSchema.filter((field) => "name" in field && field.name === "open");
  return (
    <div className="post-poll-block">
      <div className="post-poll-block__header">
        <strong><span className="post-poll-block__icon"><ChartNoAxesColumn size={22} aria-hidden="true" /></span> Avstemning</strong>
        <AdminButton variant="ghost" size="icon-sm" aria-label="Fjern avstemning" disabled={!editable} onClick={() => editor.update(() => { $getNodeByKey(nodeKey)?.remove(); })}><X size={20} aria-hidden="true" /></AdminButton>
      </div>
      <RenderFields fields={fields} forceRender parentIndexPath="" parentPath="" parentSchemaPath="" permissions={true} readOnly={!editable} />
      <details className="post-poll-block__settings" onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          event.currentTarget.open = false;
          event.currentTarget.querySelector("summary")?.focus();
        }
      }}>
        <summary className={adminButtonStyles({ variant: "ghost", size: "sm" })}><Settings2 size={16} aria-hidden="true" /> Avstemningsinnstillinger{open === false ? " · Avsluttet" : ""}</summary>
        <RenderFields fields={settings} forceRender parentIndexPath="" parentPath="" parentSchemaPath="" permissions={true} readOnly={!editable} />
        <p className="post-poll-block__hint">Gjester kan stemme etter publisering. Én stemme per nettleser, ikke en sikker identitetskontroll.</p>
      </details>
    </div>
  );
}
