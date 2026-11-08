import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { legacyPostToEditor } from "@/lib/legacy-post-editor";
import PostContent from "@/components/PostContent";
import PostRichText from "@/components/PostRichText";
import type { Media } from "@/payload-types";

const image: Media = {
  id: 42, alt: "Couple photo", url: "/api/media/file/couple.png", width: 800, height: 600,
  createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z",
};

describe("Visual post editor", () => {
  it("converts old title/text/photo blocks in their existing order", () => {
    const data = legacyPostToEditor({ description: "Excerpt", content: [
      { blockType: "text", heading: "Heading", text: "First\n\nSecond" },
      { blockType: "image", image, caption: "Our photo" },
    ] });
    expect(data.root.children.map((node) => node.type)).toEqual(["heading", "paragraph", "paragraph", "upload"]);
    const html = renderToStaticMarkup(<PostRichText data={data} />);
    expect(html).toContain("Our photo");
    expect(html).toContain('alt="Couple photo"');
    expect(html).not.toContain("Excerpt");
    expect(html.indexOf("Heading")).toBeLessThan(html.indexOf("First"));
    expect(html.indexOf("Second")).toBeLessThan(html.indexOf("<figure"));
  });

  it("keeps legacy cover and description when no blocks exist", () => {
    const data = legacyPostToEditor({ description: "Old text", photo: image });
    expect(data.root.children.map((node) => node.type)).toEqual(["upload", "paragraph"]);
  });

  it("does not bring back old content when a visual document is deliberately emptied", () => {
    const empty = legacyPostToEditor({ description: "" });
    const html = renderToStaticMarkup(<PostContent post={{ description: "Old text", photo: image, body: empty }} />);
    expect(html).not.toContain("Old text");
    expect(html).not.toContain("<img");
  });

  it("preserves bold formatting and allowed font sizes", () => {
    const data = legacyPostToEditor({ description: "Large bold text" });
    const paragraph = data.root.children[0];
    if (paragraph.type !== "paragraph") throw new Error("Expected paragraph");
    const text = paragraph.children[0];
    Object.assign(text, { format: 1, $: { size: "large" } });
    const html = renderToStaticMarkup(<PostRichText data={data} />);
    expect(html).toContain("font-size:1.375rem");
    expect(html).toContain("<strong>Large bold text</strong>");
  });

  it("ignores unknown size values", () => {
    const data = legacyPostToEditor({ description: "Normal text" });
    const paragraph = data.root.children[0];
    if (paragraph.type !== "paragraph") throw new Error("Expected paragraph");
    Object.assign(paragraph.children[0], { $: { size: "1000px" } });
    expect(renderToStaticMarkup(<PostRichText data={data} />)).not.toContain("1000px");
  });

  it("keeps plain text escaped", () => {
    const data = legacyPostToEditor({ description: "<script>alert(1)</script>" });
    const html = renderToStaticMarkup(<PostRichText data={data} />);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
