import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import NewsCard from "@/components/NewsCard";
import PostContent from "@/components/PostContent";
import { articleDate } from "@/lib/article-date";
import type { Media, Post } from "@/payload-types";

const image: Media = {
  id: 7,
  alt: "Brudeparet ved sjøen",
  url: "/api/media/file/couple.jpg",
  width: 1200,
  height: 800,
  focalX: 25,
  focalY: 70,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

function post(overrides: Partial<Post> = {}): Post {
  return {
    id: 1,
    title: "Velkommen",
    description: "Kort introduksjon",
    theme: "Praktisk info",
    visibility: "public",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("article presentation", () => {
  it("keeps a media area on default cards without inventing an image", () => {
    const html = renderToStaticMarkup(<NewsCard post={post()} />);
    expect(html).toContain('href="/news/1"');
    expect(html).toContain("Les mer");
    expect(html).not.toContain("<img");
  });

  it("uses cover focal coordinates on default cards", () => {
    const html = renderToStaticMarkup(<NewsCard post={post({ photo: image })} />);
    expect(html).toContain('alt="Brudeparet ved sjøen"');
    expect(html).toContain("object-position:25% 70%");
  });

  it("can render only authored legacy blocks without repeating summary fields", () => {
    const html = renderToStaticMarkup(
      <PostContent
        post={{
          ...post({ photo: image }),
          content: [{ blockType: "text", text: "Forfattet brødtekst" }],
        }}
        fallbackToSummary={false}
      />,
    );
    expect(html).toContain("Forfattet brødtekst");
    expect(html).not.toContain("Kort introduksjon");
    expect(html).not.toContain("<img");
  });

  it("omits summary fallback when an old article has no authored body", () => {
    expect(renderToStaticMarkup(<PostContent post={post({ photo: image })} fallbackToSummary={false} />)).toBe("");
  });

  it("falls back from an absent or invalid publication date to creation date", () => {
    expect(articleDate(null, "2026-10-18T10:00:00Z")?.label).toContain("18. oktober 2026");
    expect(articleDate("not-a-date", "2026-10-18T10:00:00Z")?.iso).toBe("2026-10-18T10:00:00.000Z");
  });
});
