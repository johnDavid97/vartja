const SCROLL_TOLERANCE = 2;

export interface CarouselPosition {
  activePage: number;
  canGoPrevious: boolean;
  canGoNext: boolean;
}

/** Dots describe the nearest page; arrows describe the actual scroll boundaries. */
export function carouselPosition(targets: readonly number[], scrollLeft: number, maxScroll: number): CarouselPosition {
  let activePage = 0;
  let nearestDistance = Number.POSITIVE_INFINITY;
  targets.forEach((target, index) => {
    const distance = Math.abs(scrollLeft - target);
    if (distance < nearestDistance) {
      activePage = index;
      nearestDistance = distance;
    }
  });
  return {
    activePage,
    canGoPrevious: scrollLeft > SCROLL_TOLERANCE,
    canGoNext: scrollLeft < maxScroll - SCROLL_TOLERANCE,
  };
}

/** A partial/manual scroll must still be able to return to its nearest boundary. */
export function pageInDirection(targets: readonly number[], scrollLeft: number, direction: "previous" | "next"): number {
  if (direction === "previous") {
    for (let index = targets.length - 1; index >= 0; index -= 1) {
      if (targets[index] < scrollLeft - SCROLL_TOLERANCE) return index;
    }
    return 0;
  }
  const nextPage = targets.findIndex((target) => target > scrollLeft + SCROLL_TOLERANCE);
  return nextPage === -1 ? Math.max(0, targets.length - 1) : nextPage;
}

export function carouselPageTargets(slideOffsets: readonly number[], viewportWidth: number, scrollWidth: number): number[] {
  if (slideOffsets.length === 0) return [0];
  const maxScroll = Math.max(0, scrollWidth - viewportWidth);
  const stride = slideOffsets.length > 1 ? slideOffsets[1] - slideOffsets[0] : viewportWidth;
  // Ignore the partly-visible next card when determining a responsive page's size.
  const cardsPerPage = Math.max(1, Math.floor(viewportWidth / Math.max(1, stride)));
  const targets: number[] = [];
  for (let index = 0; index < slideOffsets.length; index += cardsPerPage) {
    const target = Math.min(slideOffsets[index] - slideOffsets[0], maxScroll);
    const previous = targets.at(-1);
    if (previous === undefined || Math.abs(target - previous) > SCROLL_TOLERANCE) targets.push(target);
  }
  return targets;
}
