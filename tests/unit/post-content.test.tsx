import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import PostContent from "@/components/PostContent";
import { getPostContent, splitParagraphs, type PostContentSource } from "@/lib/post-content";
import type { Media } from "@/payload-types";

const photo: Media = {
  id: 1,
  alt: "Wedding venue",
  url: "/api/media/file/venue.jpg",
  width: 1200,
  height: 800,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};
const legacy: PostContentSource = { description: "Original description", photo };
const blocks: PostContentSource = {
  ...legacy,
  content: [
    { blockType: "text", heading: "First section", text: "First paragraph" },
    { blockType: "image", image: photo, caption: "Venue caption" },
    { blockType: "text", text: "Last paragraph" },
  ],
};

describe("Post blocks", () => {
  it("keeps legacy posts in photo then text order", () => {
    expect(getPostContent(legacy).map((block) => block.blockType)).toEqual(["image", "text"]);
  });
  it("falls back to the old content when all blocks are removed", () => {
    expect(getPostContent({ ...legacy, content: [] })).toEqual(getPostContent(legacy));
  });
  it("uses blocks instead of duplicating the card description and cover", () => {
    expect(getPostContent(blocks)).toEqual(blocks.content);
    const html = renderToStaticMarkup(<PostContent post={blocks} />);
    expect(html).not.toContain("Original description");
    expect(html.match(/<img /g)).toHaveLength(1);
  });
  it("renders text and photos in their saved order", () => {
    const html = renderToStaticMarkup(<PostContent post={blocks} />);
    expect(html.indexOf("First paragraph")).toBeLessThan(html.indexOf("<figure"));
    expect(html.indexOf("<figure")).toBeLessThan(html.indexOf("Last paragraph"));
    expect(html).toContain('alt="Wedding venue"');
    expect(html).toContain("Venue caption");
  });
  it("reflects reordered blocks", () => {
    const html = renderToStaticMarkup(<PostContent post={{ ...blocks, content: [...blocks.content!].reverse() }} />);
    expect(html.indexOf("Last paragraph")).toBeLessThan(html.indexOf("First paragraph"));
  });
  it("renders legacy descriptions", () => {
    expect(renderToStaticMarkup(<PostContent post={legacy} />)).toContain("Original description");
  });
  it("skips missing photo relationships without breaking other content", () => {
    const html = renderToStaticMarkup(<PostContent post={{ ...blocks, content: [
      { blockType: "image", image: 999 },
      { blockType: "text", text: "Still visible" },
    ] }} />);
    expect(html).not.toContain("<img");
    expect(html).toContain("Still visible");
  });
  it("escapes user-entered HTML", () => {
    const html = renderToStaticMarkup(<PostContent post={{ description: "<script>alert(1)</script>" }} />);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
  it("handles posts without a cover image", () => {
    expect(getPostContent({ description: "Hello" })).toEqual([{ blockType: "text", text: "Hello" }]);
  });
});

describe("Paragraphs", () => {
  it("preserves paragraphs but joins single line breaks", () => {
    expect(splitParagraphs("First\nline\n\nSecond\r\nline")).toEqual(["First line", "Second line"]);
  });
  it("ignores blank input", () => {
    expect(splitParagraphs(" \n\n ")).toEqual([]);
  });
});
