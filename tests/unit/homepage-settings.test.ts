import { describe, expect, it } from "vitest";
import type { Wedding, Media, Post } from "../../payload-types";
import { DEFAULT_HERO_COLOR, isHexColor, toHomepageSettings } from "../../features/homepage/settings";
import { heroTextColor } from "../../features/homepage/contrast";
import { LoadHomepage, type HomepageRepository } from "../../features/homepage/application/LoadHomepage";

const wedding: Wedding = { id: 1, coupleNames: "Andrea & Martin", weddingDate: "2027-07-27T10:00:00Z", heroBackgroundMode: "color", heroBackgroundColor: DEFAULT_HERO_COLOR };

describe("homepage settings", () => {
  it("preserves existing names, date and text without mutating records", () => {
    const original = { ...wedding, welcomeMessage: "Hei!", venue: "Skottland" };
    const before = structuredClone(original);
    const settings = toHomepageSettings(original);
    expect(settings).toMatchObject({ names: wedding.coupleNames, date: wedding.weddingDate, welcomeMessage: "Hei!", venue: "Skottland", backgroundMode: "color", backgroundColor: DEFAULT_HERO_COLOR, image: null });
    expect(original).toEqual(before);
  });
  it("preserves intentionally empty decorative headings", () => {
    expect(toHomepageSettings({ ...wedding, heroEyebrow: "", heroTitleSuffix: "" })).toMatchObject({ heroEyebrow: "", heroTitleSuffix: "" });
  });
  it("uses only populated image data and clamps focal points", () => {
    const photo: Media = { id: 8, alt: "Paret", url: "/api/media/file/pair.png", focalX: 120, focalY: -20, createdAt: "", updatedAt: "" };
    expect(toHomepageSettings({ ...wedding, heroBackgroundMode: "image", heroImage: photo }).image).toEqual({ src: photo.url, alt: "Paret", focalX: 100, focalY: 0 });
    expect(toHomepageSettings({ ...wedding, heroImage: photo.id }).image).toBeNull();
    expect(toHomepageSettings({ ...wedding, heroImage: { ...photo, focalX: NaN, focalY: null } }).image).toMatchObject({ focalX: 50, focalY: 50 });
  });
  it.each(["red", "#fff", "url(https://example.org)", "#12345g", "#ffffff; color:red", null])("rejects non-hex colour %s", (value) => {
    expect(isHexColor(value)).toBe(false);
  });
  it("accepts six-digit hex and safely defaults legacy invalid colours", () => {
    expect(isHexColor("#aBc123")).toBe(true);
    expect(toHomepageSettings({ ...wedding, heroBackgroundColor: "bad" }).backgroundColor).toBe(DEFAULT_HERO_COLOR);
  });
  it("uses contrasting text for dark, light and middle-grey backgrounds", () => {
    expect(heroTextColor("#3c4641")).toBe("#ffffff");
    expect(heroTextColor("#ffffff")).toBe("#000000");
    expect(heroTextColor("#777777")).toBe("#000000");
    expect(heroTextColor("invalid")).toBe("#ffffff");
  });
  it("uses injected storage without requiring a Payload runtime", async () => {
    const posts: Post[] = [];
    const repository: HomepageRepository = { readWedding: async () => wedding, readPublishedPosts: async () => posts };
    const service = new LoadHomepage(repository);
    expect((await service.settings()).names).toBe(wedding.coupleNames);
    expect(await service.updates()).toBe(posts);
  });
});
