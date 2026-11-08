"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { LexicalEditor, NodeKey } from "@payloadcms/richtext-lexical/lexical";

export type InsertTarget = { key: NodeKey | null; position: "before" | "after" };
export const POST_BLOCK_MIME = "application/x-sammen-post-block";

type EditorContext = {
  editor: LexicalEditor | null;
  setEditor: React.Dispatch<React.SetStateAction<LexicalEditor | null>>;
};
const Context = createContext<EditorContext | null>(null);

export default function PostEditorProvider({ children }: { children: ReactNode }) {
  const [editor, setEditor] = useState<LexicalEditor | null>(null);
  const value = useMemo(() => ({ editor, setEditor }), [editor]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function usePostEditor() {
  const context = useContext(Context);
  if (!context) throw new Error("PostEditorProvider is missing from Payload admin providers.");
  return context;
}
