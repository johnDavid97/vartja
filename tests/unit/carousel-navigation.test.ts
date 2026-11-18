import { describe, expect, it } from "vitest";
import { carouselPageTargets, carouselPosition, pageInDirection } from "../../features/homepage/carousel-navigation";

const targets = [0, 900, 1200];

describe("carousel navigation", () => {
  it("keeps previous enabled after a manual scroll within the first page", () => {
    expect(carouselPosition(targets, 300, 1200)).toEqual({ activePage: 0, canGoPrevious: true, canGoNext: true });
    expect(pageInDirection(targets, 300, "previous")).toBe(0);
    expect(pageInDirection(targets, 300, "next")).toBe(1);
  });
  it("keeps next enabled near the final page until the actual end", () => {
    expect(carouselPosition(targets, 1150, 1200)).toEqual({ activePage: 2, canGoPrevious: true, canGoNext: true });
    expect(pageInDirection(targets, 1150, "next")).toBe(2);
  });
  it("disables only the corresponding boundary, tolerating fractional pixels", () => {
    expect(carouselPosition(targets, 0.5, 1200)).toMatchObject({ canGoPrevious: false, canGoNext: true });
    expect(carouselPosition(targets, 1199.5, 1200)).toMatchObject({ canGoPrevious: true, canGoNext: false });
    expect(carouselPosition([0], 0, 0)).toMatchObject({ canGoPrevious: false, canGoNext: false });
  });
  it("navigates relative to actual position rather than the nearest dot", () => {
    expect(pageInDirection(targets, 700, "previous")).toBe(0);
    expect(pageInDirection(targets, 700, "next")).toBe(1);
    expect(pageInDirection(targets, 900, "previous")).toBe(0);
    expect(pageInDirection(targets, 900, "next")).toBe(2);
    expect(pageInDirection([], 0, "next")).toBe(0);
  });
  it("builds responsive targets with offset padding and clamps the last page", () => {
    const offsets = [4, 304, 604, 904, 1204, 1504, 1804];
    expect(carouselPageTargets(offsets, 950, 2100)).toEqual([0, 900, 1150]);
    expect(carouselPageTargets(offsets, 650, 2100)).toEqual([0, 600, 1200, 1450]);
    expect(carouselPageTargets(offsets, 350, 2100)).toEqual([0, 300, 600, 900, 1200, 1500, 1750]);
  });
  it("does not produce redundant pages when content fits or is empty", () => {
    expect(carouselPageTargets([4, 304], 950, 950)).toEqual([0]);
    expect(carouselPageTargets([4], 350, 350)).toEqual([0]);
    expect(carouselPageTargets([], 350, 350)).toEqual([0]);
  });
});
