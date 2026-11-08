"use client";

import {
  $createParagraphNode, $getNodeByKey, $getRoot, $getSelection, $isRangeSelection,
  type LexicalEditor, type LexicalNode,
} from "@payloadcms/richtext-lexical/lexical";
import { $createBlockNode, $createHorizontalRuleNode } from "@payloadcms/richtext-lexical/client";
import type { InsertTarget } from "./PostEditorProvider";

export function getSelectionTarget(editor: LexicalEditor): InsertTarget {
  return editor.getEditorState().read(() => {
    const selection = $getSelection();
    const node = $isRangeSelection(selection) ? selection.anchor.getNode().getTopLevelElement() : null;
    return { key: node?.getKey() || null, position: "after" };
  });
}

/** Must run inside editor.update(). Insert as a sibling, never inside text. */
function insertAtTarget(node: LexicalNode, target: InsertTarget) {
  const anchor = target.key ? $getNodeByKey(target.key) : null;
  if (anchor?.isAttached()) {
    if (target.position === "before") anchor.insertBefore(node);
    else anchor.insertAfter(node);
  } else {
    $getRoot().append(node);
  }
}

export type SidebarBlockKind = "photo" | "poll" | "horizontalRule";

export function insertSidebarBlock(editor: LexicalEditor, kind: SidebarBlockKind, target: InsertTarget) {
  if (!editor.isEditable()) return;
  editor.update(() => {
    const block = kind === "horizontalRule" ? $createHorizontalRuleNode() : $createBlockNode(kind === "photo"
      ? { blockType: "photo", blockName: "", image: null, caption: "", alt: "" }
      : { blockType: "poll", blockName: "", question: "", open: true, options: [
          { id: crypto.randomUUID(), label: "" }, { id: crypto.randomUUID(), label: "" },
        ] });
    insertAtTarget(block, target);
    if (!block.getNextSibling()) block.insertAfter($createParagraphNode());
  }, { discrete: true });
}
