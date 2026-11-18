import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import LatestUpdates from "@/components/homepage/LatestUpdates";
import NewsCard from "@/components/NewsCard";
import NewsCards from "@/components/NewsCards";
import type { Post } from "@/payload-types";

function post(overrides: Partial<Post> = {}): Post {
  return {
    id: 1,
    title: "Velkommen til bryllupssiden",
    description: "Her samler vi det dere trenger å vite før den store dagen.",
    theme: "Praktisk info",
    visibility: "public",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("homepage news", () => {
  it("renders an honest empty state without carousel controls", () => {
    const html = renderToStaticMarkup(<LatestUpdates posts={[]} />);

    expect(html).toContain("OPPDATERINGER");
    expect(html).toContain("Siste nytt fra oss");
    expect(html).toContain("Det er ingen oppdateringer ennå.");
    expect(html).not.toContain("Neste side");
    expect(html).not.toContain("Gå til side");
  });

  it("renders linked homepage cards and no useless controls for one post", () => {
    const html = renderToStaticMarkup(<LatestUpdates posts={[post()]} />);

    expect(html).toContain('href="/news/1"');
    expect(html).toContain("Velkommen til bryllupssiden");
    expect(html).toContain("Praktisk info");
    expect(html).toContain("Les mer");
    expect(html).not.toContain("Neste side");
  });

  it("renders each server card in its own slide, not one fragment containing every card", () => {
    const html = renderToStaticMarkup(<LatestUpdates posts={[post(), post({ id: 2 }), post({ id: 3 })]} />);
    expect(html.match(/data-update-slide=/g)).toHaveLength(3);
  });

  it("uses the real uploaded photo when one is available", () => {
    const html = renderToStaticMarkup(
      <NewsCard
        variant="homepage"
        post={post({
          photo: {
            id: 9,
            alt: "Brudeparet ved sjøen",
            url: "/api/media/file/couple.jpg",
            createdAt: "2026-01-01T00:00:00Z",
            updatedAt: "2026-01-01T00:00:00Z",
          },
        })}
      />,
    );

    expect(html).toContain('alt="Brudeparet ved sjøen"');
    expect(html).toContain("couple.jpg");
  });

  it("keeps the reusable default news list linked to each real post", () => {
    const html = renderToStaticMarkup(
      <NewsCards posts={[post(), post({ id: 2, title: "Overnatting" })]} />,
    );

    expect(html).toContain('href="/news/1"');
    expect(html).toContain('href="/news/2"');
    expect(html).toContain("Overnatting");
  });
});
