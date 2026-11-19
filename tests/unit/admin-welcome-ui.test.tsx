import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import WelcomeView from "@/components/admin/WelcomeView";

describe("admin welcome UI", () => {
  it("renders real summary counts, including zero, without adding navigation", () => {
    const html = renderToStaticMarkup(
      <WelcomeView summary={{ totalHouseholds: 12, pendingHouseholds: 0, visiblePosts: 4 }} />,
    );

    expect(html).toContain("Velkommen");
    expect(html).toContain("Husstander");
    expect(html).toContain(">12<");
    expect(html).toContain("Til godkjenning");
    expect(html).toContain(">0<");
    expect(html).toContain("Synlige for godkjente gjester");
    expect(html).toContain(">4<");
    expect(html).not.toContain("<a");
    expect(html).not.toContain("<button");
  });

  it("only highlights a non-zero pending count", () => {
    const zero = renderToStaticMarkup(
      <WelcomeView summary={{ totalHouseholds: 3, pendingHouseholds: 0, visiblePosts: 1 }} />,
    );
    const pending = renderToStaticMarkup(
      <WelcomeView summary={{ totalHouseholds: 3, pendingHouseholds: 2, visiblePosts: 1 }} />,
    );

    expect(zero).not.toContain("pending");
    expect(pending).toContain("pending");
  });

  it("announces unavailable data and shows accessible dashes instead of zeros", () => {
    const html = renderToStaticMarkup(<WelcomeView summary={null} />);

    expect(html).toContain('role="status"');
    expect(html).toContain("Oversikten kunne ikke lastes inn.");
    expect(html.match(/aria-hidden="true">—/g)).toHaveLength(3);
    expect(html.match(/Ikke tilgjengelig/g)).toHaveLength(3);
    expect(html).not.toContain(">0<");
  });
});
