"use client";

import { RenderFields } from "@payloadcms/ui";
import { BlockRemoveButton, useBlockComponentContext } from "@payloadcms/richtext-lexical/client";
import { useLexicalComposerContext } from "@payloadcms/richtext-lexical/lexical/react/LexicalComposerContext";
import { ChartNoAxesColumn } from "lucide-react";

export function PollBlock() {
  const { formSchema } = useBlockComponentContext();
  const [editor] = useLexicalComposerContext();
  return (
    <div className="post-poll-block">
      <div className="post-poll-block__header">
        <strong><ChartNoAxesColumn size={20} aria-hidden="true" /> Avstemning</strong>
        <BlockRemoveButton />
      </div>
      <RenderFields fields={formSchema} forceRender parentIndexPath="" parentPath="" parentSchemaPath="" permissions={true} readOnly={!editor.isEditable()} />
      <p>Gjester kan stemme etter publisering. Én stemme per nettleser, ikke en sikker identitetskontroll.</p>
    </div>
  );
}
