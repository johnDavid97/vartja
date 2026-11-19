import { describe, expect, it } from "vitest";
import type { Media, Post } from "@/payload-types";
import { articleContentAfterCover } from "@/lib/article-content";

const cover: Media = { id: 7, alt: "Cover", url: "/api/media/file/cover.jpg", createdAt: "2026-01-01", updatedAt: "2026-01-01" };
const upload = (id: number | string = 7, caption = "") => ({ type: "upload", version: 3, relationTo: "media", value: id, fields: { caption } });
const paragraph = { type: "paragraph", version: 1, children: [{ type: "text", version: 1, text: "Article text" }] };
function post(children: Record<string, unknown>[]): Post {
  return {
    id: 3, title: "Article", description: "Intro", photo: cover, visibility: "public",
    createdAt: "2026-01-01", updatedAt: "2026-01-01",
    body: { root: { type: "root", version: 1, direction: null, format: "", indent: 0, children: children as NonNullable<Post["body"]>["root"]["children"] } },
  };
}

describe("article cover presentation", () => {
  it("omits only the first matching uncaptioned upload without mutating saved content", () => {
    const original = post([upload(), paragraph, upload()]);
    const snapshot = JSON.stringify(original);
    const rendered = articleContentAfterCover(original);
    expect(rendered.body?.root.children).toEqual([paragraph, upload()]);
    expect(JSON.stringify(original)).toBe(snapshot);
    expect(rendered.body).not.toBe(original.body);
  });

  it.each([7, "7", cover])("recognizes numeric, string and populated media relationships", (value) => {
    const original = post([{ ...upload(), value }, paragraph]);
    expect(articleContentAfterCover(original).body?.root.children).toEqual([paragraph]);
  });

  it("preserves captioned, different, later and nested images", () => {
    for (const children of [
      [upload(7, "Keep this caption"), paragraph],
      [upload(8), paragraph],
      [paragraph, upload()],
      [{ type: "quote", version: 1, children: [upload()] }],
      [{ ...upload(), relationTo: "other-collection" }],
    ]) {
      const original = post(children);
      expect(articleContentAfterCover(original)).toBe(original);
    }
  });

  it("does not omit a picture when no usable cover is rendered", () => {
    for (const photo of [null, 7, { ...cover, url: null }]) {
      const original = { ...post([upload()]), photo };
      expect(articleContentAfterCover(original)).toBe(original);
    }
  });

  it("handles leading photo blocks while preserving captions and custom alt descriptions", () => {
    const photo = { type: "block", version: 2, fields: { blockType: "photo", image: cover, caption: "", alt: "" } };
    expect(articleContentAfterCover(post([photo, paragraph])).body?.root.children).toEqual([paragraph]);
    for (const fields of [{ ...photo.fields, caption: "Keep" }, { ...photo.fields, alt: "An important different description" }]) {
      const original = post([{ ...photo, fields }]);
      expect(articleContentAfterCover(original)).toBe(original);
    }
  });

  it("handles legacy blocks and keeps later repetitions untouched", () => {
    const image = { blockType: "image" as const, image: cover };
    const original = { ...post([]), body: null, content: [image, { blockType: "text" as const, text: "Body" }, image] };
    const rendered = articleContentAfterCover(original);
    expect(rendered.content).toEqual(original.content.slice(1));
    expect(original.content).toHaveLength(3);
    const captioned = { ...original, content: [{ ...image, caption: "Keep" }] };
    expect(articleContentAfterCover(captioned)).toBe(captioned);
  });

  it("preserves an intentionally empty rich-text body instead of falling back to legacy blocks", () => {
    const original = { ...post([]), content: [{ blockType: "image" as const, image: cover }] };
    expect(articleContentAfterCover(original)).toBe(original);
  });
});
