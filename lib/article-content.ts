import type { Post } from "@/payload-types";

type RecordValue = Record<string, unknown>;

function record(value: unknown): RecordValue | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as RecordValue
    : null;
}

function referencesCover(value: unknown, coverId: number): boolean {
  const id = record(value)?.id ?? value;
  return id === coverId || id === String(coverId);
}

function hasCaption(value: unknown): boolean {
  return typeof value === "string" ? value.trim().length > 0 : value != null;
}

/** Presentation only: never edit the saved document or remove images later in the body. */
export function articleContentAfterCover(post: Post): Post {
  const cover = typeof post.photo === "object" ? post.photo : null;
  if (!cover?.url) return post; // Nothing was rendered above the article to replace this image.

  if (post.body != null) {
    const first = post.body.root.children[0];
    if (!first) return post;
    const fields = record(first.fields);
    const isUpload = first.type === "upload" && first.relationTo === "media"
      && referencesCover(first.value, cover.id) && !hasCaption(fields?.caption);
    const isPhotoBlock = first.type === "block" && fields?.blockType === "photo"
      && referencesCover(fields.image, cover.id) && !hasCaption(fields.caption)
      && (!fields.alt || fields.alt === cover.alt);
    if (!isUpload && !isPhotoBlock) return post;

    return {
      ...post,
      body: {
        ...post.body,
        root: { ...post.body.root, children: post.body.root.children.slice(1) },
      },
    };
  }

  const first = post.content?.[0];
  if (first?.blockType !== "image" || !referencesCover(first.image, cover.id) || hasCaption(first.caption)) return post;
  return { ...post, content: post.content!.slice(1) };
}
