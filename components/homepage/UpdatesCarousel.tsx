"use client";

import { Children, type KeyboardEvent, type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import styles from "./updates.module.css";

type UpdatesCarouselProps = {
  children: ReactNode;
  itemCount: number;
};

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export default function UpdatesCarousel({ children, itemCount }: UpdatesCarouselProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [pageTargets, setPageTargets] = useState<number[]>([]);
  const [activePage, setActivePage] = useState(0);

  const updateActivePage = useCallback((targets: number[]) => {
    const viewport = viewportRef.current;
    if (!viewport || targets.length === 0) return;

    let nearest = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;
    targets.forEach((target, index) => {
      const distance = Math.abs(viewport.scrollLeft - target);
      if (distance < nearestDistance) {
        nearest = index;
        nearestDistance = distance;
      }
    });
    setActivePage(nearest);
  }, []);

  const measure = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const slides = Array.from(viewport.querySelectorAll<HTMLElement>("[data-update-slide]"));
    const maxScroll = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
    const nextTargets: number[] = [];
    const firstSlide = slides[0];
    const secondSlide = slides[1];
    const stride = firstSlide
      ? (secondSlide ? secondSlide.offsetLeft - firstSlide.offsetLeft : firstSlide.offsetWidth)
      : viewport.clientWidth;
    // The CSS deliberately leaves part of the next card visible. Count only fully
    // visible cards so each control advances one responsive page (1, 2, or 3 cards).
    const cardsPerPage = Math.max(1, Math.floor(viewport.clientWidth / Math.max(1, stride)));

    for (let index = 0; index < slides.length; index += cardsPerPage) {
      const target = Math.min(slides[index].offsetLeft - slides[0].offsetLeft, maxScroll);
      const previous = nextTargets.at(-1);
      if (previous === undefined || Math.abs(target - previous) > 2) nextTargets.push(target);
    }

    if (nextTargets.length === 0) nextTargets.push(0);
    setPageTargets(nextTargets);
    updateActivePage(nextTargets);
  }, [updateActivePage]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(() => requestAnimationFrame(measure));
    observer.observe(viewport);
    const track = viewport.firstElementChild;
    if (track) observer.observe(track);
    measure();

    return () => observer.disconnect();
  }, [measure, itemCount]);

  const goToPage = (page: number) => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const boundedPage = Math.max(0, Math.min(page, pageTargets.length - 1));
    viewport.scrollTo({
      left: pageTargets[boundedPage],
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    });
    setActivePage(boundedPage);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      goToPage(activePage - 1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      goToPage(activePage + 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      goToPage(0);
    } else if (event.key === "End") {
      event.preventDefault();
      goToPage(pageTargets.length - 1);
    }
  };

  const hasControls = itemCount > 1 && pageTargets.length > 1;

  return (
    <div className={styles.carousel}>
      {hasControls && (
        <div className={styles.arrows} role="group" aria-label="Naviger i oppdateringer">
          <Button
            type="button"
            variant="outline"
            size="icon-lg"
            className={styles.arrowButton}
            onClick={() => goToPage(activePage - 1)}
            disabled={activePage === 0}
            aria-label="Forrige side"
          >
            <ChevronLeft aria-hidden="true" />
          </Button>
          <Button
            type="button"
            size="icon-lg"
            className={styles.nextButton}
            onClick={() => goToPage(activePage + 1)}
            disabled={activePage === pageTargets.length - 1}
            aria-label="Neste side"
          >
            <ChevronRight aria-hidden="true" />
          </Button>
        </div>
      )}

      <div
        ref={viewportRef}
        className={styles.viewport}
        role="region"
        aria-roledescription="karusell"
        aria-label="Bla i oppdateringer"
        tabIndex={hasControls ? 0 : -1}
        onKeyDown={handleKeyDown}
        onScroll={() => updateActivePage(pageTargets)}
      >
        <ul className={styles.track}>
          {Children.map(children, (child, index) => (
            <li className={styles.slide} data-update-slide aria-label={`${index + 1} av ${itemCount}`}>
              {child}
            </li>
          ))}
        </ul>
      </div>

      {hasControls && (
        <div className={styles.dots} role="group" aria-label="Velg side">
          {pageTargets.map((_, index) => (
            <button
              key={index}
              type="button"
              className={styles.dot}
              data-active={index === activePage || undefined}
              aria-current={index === activePage ? "page" : undefined}
              aria-label={`Gå til side ${index + 1} av ${pageTargets.length}`}
              onClick={() => goToPage(index)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
