import type { CSSProperties } from "react";
import Image from "next/image";
import WeddingCountdown from "@/components/WeddingCountdown";
import type { HomepageSettings } from "@/features/homepage/models";
import styles from "./hero.module.css";
import { DEFAULT_HERO_COLOR, isHexColor } from "@/features/homepage/settings";
import { heroTextColor } from "@/features/homepage/contrast";

function dateValue(date: string) {
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (dateOnly) {
    return {
      value: new Date(Date.UTC(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))),
      timeZone: "UTC",
    };
  }
  return { value: new Date(date), timeZone: "Europe/Oslo" };
}

export function formatWeddingDate(date: string) {
  const parsed = dateValue(date);
  if (Number.isNaN(parsed.value.getTime())) return "Dato kommer";
  return new Intl.DateTimeFormat("nb-NO", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: parsed.timeZone,
  }).format(parsed.value);
}

export default function WeddingHero({ settings }: { settings: HomepageSettings }) {
  const hasImage = settings.backgroundMode === "image" && Boolean(settings.image?.src);
  const background = isHexColor(settings.backgroundColor) ? settings.backgroundColor : DEFAULT_HERO_COLOR;
  const heroStyle = {
    "--hero-background": background,
    "--hero-color": hasImage ? "#ffffff" : heroTextColor(background),
  } as CSSProperties;

  return (
    <section className={hasImage ? `${styles.hero} ${styles.imageHero}` : styles.hero} style={heroStyle}>
      {hasImage && settings.image && (
        <Image
          className={styles.heroImage}
          src={settings.image.src}
          alt={settings.image.alt}
          fill
          sizes="100vw"
          loading="eager"
          unoptimized
          style={{ objectPosition: `${settings.image.focalX}% ${settings.image.focalY}%` }}
        />
      )}
      {hasImage && <div className={styles.imageOverlay} aria-hidden="true" />}

      <div className={styles.heroContent}>
        {settings.heroEyebrow && <p className={styles.eyebrow}>{settings.heroEyebrow}</p>}
        <h1 className={styles.title}>
          <span>{settings.names}</span>
          {settings.heroTitleSuffix && <em>{settings.heroTitleSuffix}</em>}
        </h1>
        <p className={styles.dateLine}>
          <span>{formatWeddingDate(settings.date)}</span>
          {settings.venue && <span>{settings.venue}</span>}
        </p>
        <WeddingCountdown date={settings.date} />
        {settings.welcomeMessage && <p className={styles.welcome}>{settings.welcomeMessage}</p>}
      </div>
    </section>
  );
}
