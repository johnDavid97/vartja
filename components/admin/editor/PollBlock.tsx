"use client";

import { RenderFields, useFormFields } from "@payloadcms/ui";
import { useBlockComponentContext } from "@payloadcms/richtext-lexical/client";
import { $getNodeByKey } from "@payloadcms/richtext-lexical/lexical";
import { useLexicalEditable } from "@payloadcms/richtext-lexical/lexical/react/useLexicalEditable";
import { useLexicalComposerContext } from "@payloadcms/richtext-lexical/lexical/react/LexicalComposerContext";
import { PollEditorFrame } from "./PollEditorFrame";

export function PollBlock() {
  const { formSchema, nodeKey } = useBlockComponentContext();
  const [editor] = useLexicalComposerContext();
  const editable = useLexicalEditable();
  const open = useFormFields(([fields]) => fields.open?.value);
  const fields = formSchema.filter((field) => !("name" in field) || field.name !== "open");
  const settings = formSchema.filter((field) => "name" in field && field.name === "open");
  return <PollEditorFrame editable={editable} open={open !== false}
    onRemove={() => editor.update(() => { $getNodeByKey(nodeKey)?.remove(); })}
    hint="Gjester kan stemme etter publisering. Én stemme per nettleser, ikke en sikker identitetskontroll."
    settings={<RenderFields fields={settings} forceRender parentIndexPath="" parentPath="" parentSchemaPath="" permissions={true} readOnly={!editable} />}>
    <RenderFields fields={fields} forceRender parentIndexPath="" parentPath="" parentSchemaPath="" permissions={true} readOnly={!editable} />
  </PollEditorFrame>;
}
