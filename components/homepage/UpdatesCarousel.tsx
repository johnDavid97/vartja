"use client";

import { Children, isValidElement, type KeyboardEvent, type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import styles from "./updates.module.css";
import { carouselPageTargets, carouselPosition, pageInDirection } from "@/features/homepage/carousel-navigation";

type UpdatesCarouselProps = {
  children: ReactNode;
};

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export default function UpdatesCarousel({ children }: UpdatesCarouselProps) {
  const items = Children.toArray(children);
  const itemCount = items.length;
  const viewportRef = useRef<HTMLDivElement>(null);
  const [pageTargets, setPageTargets] = useState<number[]>([]);
  const [position, setPosition] = useState(() => carouselPosition([], 0, 0));
  const { activePage, canGoPrevious, canGoNext } = position;

  const updatePosition = useCallback((targets: number[]) => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    setPosition(carouselPosition(targets, viewport.scrollLeft, Math.max(0, viewport.scrollWidth - viewport.clientWidth)));
  }, []);

  const measure = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const slides = Array.from(viewport.querySelectorAll<HTMLElement>("[data-update-slide]"));
    const nextTargets = carouselPageTargets(slides.map((slide) => slide.offsetLeft), viewport.clientWidth, viewport.scrollWidth);
    setPageTargets(nextTargets);
    updatePosition(nextTargets);
  }, [updatePosition]);

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
    if (!viewport || pageTargets.length === 0) return;
    const boundedPage = Math.max(0, Math.min(page, pageTargets.length - 1));
    viewport.scrollTo({
      left: pageTargets[boundedPage],
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    });
  };

  const goInDirection = (direction: "previous" | "next") => {
    const viewport = viewportRef.current;
    if (viewport) goToPage(pageInDirection(pageTargets, viewport.scrollLeft, direction));
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      goInDirection("previous");
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      goInDirection("next");
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
            onClick={() => goInDirection("previous")}
            disabled={!canGoPrevious}
            aria-label="Forrige side"
          >
            <ChevronLeft aria-hidden="true" />
          </Button>
          <Button
            type="button"
            size="icon-lg"
            className={styles.nextButton}
            onClick={() => goInDirection("next")}
            disabled={!canGoNext}
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
        onScroll={() => updatePosition(pageTargets)}
      >
        <ul className={styles.track}>
          {items.map((child, index) => (
            <li key={isValidElement(child) ? child.key : index} className={styles.slide} data-update-slide aria-label={`${index + 1} av ${itemCount}`}>
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
