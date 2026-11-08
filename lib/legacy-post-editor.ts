import type { DefaultTypedEditorState, SerializedTextNode } from "@payloadcms/richtext-lexical";
import { getPostContent, splitParagraphs, type PostContentSource } from "./post-content";

const textNode = (text: string): SerializedTextNode => ({
  type: "text", version: 1, text, format: 0, detail: 0, mode: "normal", style: "",
});

/** Adapt old articles on read; the new document is persisted only when an editor saves. */
export function legacyPostToEditor(post: PostContentSource): DefaultTypedEditorState {
  const children: DefaultTypedEditorState["root"]["children"] = [];
  const element = { version: 1, direction: null, format: "", indent: 0 } as const;

  getPostContent(post).forEach((block, index) => {
    if (block.blockType === "text") {
      if (block.heading) {
        children.push({ ...element, type: "heading", tag: "h2", children: [textNode(block.heading)] });
      }
      for (const paragraph of splitParagraphs(block.text)) {
        children.push({ ...element, type: "paragraph", children: [textNode(paragraph)], textFormat: 0, textStyle: "" });
      }
    } else if (block.blockType === "image" && block.image) {
      children.push({
        type: "upload", version: 3, format: "",
        id: block.id || index.toString(16).padStart(24, "0"),
        relationTo: "media", value: block.image,
        fields: { caption: block.caption || "" },
      });
    }
  });

  return { root: { ...element, type: "root", children } };
}
