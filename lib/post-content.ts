import type { Post, PostImageBlock, PostTextBlock } from "@/payload-types";

export type PostContentSource = Pick<Post, "content" | "description" | "photo">;
export type PostContentBlock = PostTextBlock | PostImageBlock;

/** Old posts keep their photo + description until the editor adds blocks. */
export function getPostContent(post: PostContentSource): PostContentBlock[] {
  if (post.content?.length) return post.content;

  const blocks: PostContentBlock[] = [];
  if (post.photo) blocks.push({ blockType: "image", image: post.photo });
  if (post.description) blocks.push({ blockType: "text", text: post.description });
  return blocks;
}

export function splitParagraphs(text: string): string[] {
  return text
    .split(/\r?\n\s*\r?\n/)
    .map((paragraph) => paragraph.replace(/\s*\r?\n\s*/g, " ").trim())
    .filter(Boolean);
}
