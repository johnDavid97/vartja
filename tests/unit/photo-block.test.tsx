import { expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import PostRichText from "@/components/PostRichText";
import type { Post, Media } from "@/payload-types";

function documentWithPhoto(image: Media | null): NonNullable<Post["body"]> {
  return {
    root: {
      type: "root", version: 1, direction: null, format: "", indent: 0,
      children: [{
        type: "block", version: 2, format: "",
        fields: { id: "photo-test", blockType: "photo", blockName: "", image, alt: "Accessible description", caption: "Photo caption" },
      }],
    },
  };
}

it("does not expose an empty photo placeholder to visitors", () => {
  const html = renderToStaticMarkup(<PostRichText data={documentWithPhoto(null)} />);
  expect(html).not.toContain("<figure");
  expect(html).not.toContain("Photo caption");
});

it("renders an uploaded photo with its chosen description and caption", () => {
  const image: Media = {
    id: 1, alt: "Original name", url: "/api/media/file/test.png", width: 800, height: 600,
    createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z",
  };
  const html = renderToStaticMarkup(<PostRichText data={documentWithPhoto(image)} />);
  expect(html).toContain('alt="Accessible description"');
  expect(html).toContain("Photo caption");
  expect(html).toContain("/api/media/file/test.png");
});
