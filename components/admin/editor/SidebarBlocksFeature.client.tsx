"use client";

import { useEffect } from "react";
import { createClientFeature } from "@payloadcms/richtext-lexical/client";
import { useLexicalComposerContext } from "@payloadcms/richtext-lexical/lexical/react/LexicalComposerContext";
import {
  $getNearestNodeFromDOMNode, COMMAND_PRIORITY_HIGH, DRAGOVER_COMMAND, DROP_COMMAND,
} from "@payloadcms/richtext-lexical/lexical";
import { insertSidebarBlock } from "./insert-block";
import { POST_BLOCK_MIME, usePostEditor, type InsertTarget } from "./PostEditorProvider";

function SidebarDropPlugin() {
  const [editor] = useLexicalComposerContext();
  const { setEditor } = usePostEditor();

  useEffect(() => {
    setEditor(editor);
    return () => {
      setEditor((current) => current === editor ? null : current);
    };
  }, [editor, setEditor]);

  useEffect(() => {
    const isSidebarDrag = (event: DragEvent) =>
      editor.isEditable() && Boolean(event.dataTransfer?.types.includes(POST_BLOCK_MIME));

    const removeDragOver = editor.registerCommand(DRAGOVER_COMMAND, (event) => {
      if (!isSidebarDrag(event)) return false;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
      return true;
    }, COMMAND_PRIORITY_HIGH);

    const removeDrop = editor.registerCommand(DROP_COMMAND, (event) => {
      if (!isSidebarDrag(event)) return false;
      const kind = event.dataTransfer?.getData(POST_BLOCK_MIME);
      if (kind !== "photo" && kind !== "poll" && kind !== "horizontalRule") return false;
      event.preventDefault();
      event.stopPropagation();
      let target: InsertTarget = { key: null, position: "after" };
      if (event.target instanceof Node) {
        const node = $getNearestNodeFromDOMNode(event.target)?.getTopLevelElement();
        const element = node ? editor.getElementByKey(node.getKey()) : null;
        if (node && element) {
          const rect = element.getBoundingClientRect();
          target = { key: node.getKey(), position: event.clientY < rect.top + rect.height / 2 ? "before" : "after" };
        }
      }
      insertSidebarBlock(editor, kind, target);
      return true;
    }, COMMAND_PRIORITY_HIGH);

    return () => { removeDragOver(); removeDrop(); };
  }, [editor]);

  return null;
}

export const SidebarBlocksFeatureClient = createClientFeature(({ resolvedFeatures }) => {
  // Keep each feature's nodes/renderers and formatting controls, but make the
  // sidebar the only insertion menu. Clone entries so other editors are unaffected.
  for (const [key, feature] of resolvedFeatures) {
    resolvedFeatures.set(key, {
      ...feature,
      slashMenu: undefined,
      toolbarFixed: feature.toolbarFixed ? {
        groups: feature.toolbarFixed.groups.filter((group) => !["add", "blocks", "inlineBlocks"].includes(group.key)),
      } : undefined,
    });
  }
  return { plugins: [{ Component: SidebarDropPlugin, position: "normal" }] };
});
