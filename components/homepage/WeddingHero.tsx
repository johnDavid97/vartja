import type { CSSProperties } from "react";
import Image from "next/image";
import WeddingCountdown from "@/components/WeddingCountdown";
import type { HomepageSettings } from "@/features/homepage/models";
import styles from "./hero.module.css";
import { DEFAULT_HERO_COLOR } from "@/features/homepage/settings";
import { isHexColor } from "@/lib/colors";
import { heroTextColor } from "@/features/homepage/contrast";

import { formatWeddingDate } from "@/lib/wedding-date";

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
