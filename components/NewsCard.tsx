import Image from "next/image";
import Link from "next/link";
import { ImageIcon } from "lucide-react";
import type { Post } from "@/payload-types";
import styles from "@/components/news-card.module.css";
import { weddingPath } from "@/features/wedding-site/paths";

type NewsCardProps = {
  post: Post;
  headingLevel?: "h2" | "h3";
  variant?: "default" | "homepage";
};

export default function NewsCard({
  post,
  headingLevel = "h2",
  variant = "default",
}: NewsCardProps) {
  const Heading = headingLevel;
  const photo = typeof post.photo === "object" ? post.photo : null;
  const headingId = `${variant}-post-${post.id}`;

  if (variant === "homepage") {
    return (
      <article className={styles.homepageArticle} aria-labelledby={headingId}>
        <Link href={weddingPath(`/news/${post.id}`)} className={styles.homepageLink}>
          <div className={styles.homepageMedia}>
            {photo?.url ? (
              <Image
                src={photo.url}
                alt={photo.alt}
                fill
                unoptimized
                sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 88vw"
                className={styles.homepageImage}
              />
            ) : (
              <ImageIcon className={styles.placeholderIcon} aria-hidden="true" />
            )}
          </div>
          <div className={styles.homepageBody}>
            {post.theme && <span className={styles.theme}>{post.theme}</span>}
            <Heading id={headingId} className={styles.homepageTitle}>
              {post.title}
            </Heading>
            <p className={styles.homepageDescription}>{post.description}</p>
            <span className={styles.readMore} aria-hidden="true">
              Les mer <span>→</span>
            </span>
          </div>
        </Link>
      </article>
    );
  }

  const focalX = photo?.focalX ?? 50;
  const focalY = photo?.focalY ?? 50;

  return (
    <article className={styles.defaultArticle} aria-labelledby={headingId}>
      <Link href={weddingPath(`/news/${post.id}`)} className={styles.defaultLink}>
        <div className={styles.defaultMedia} aria-hidden={photo?.url ? undefined : "true"}>
          {photo?.url && (
            <Image
              src={photo.url}
              alt={photo.alt}
              fill
              unoptimized
              sizes="(min-width: 1280px) 400px, (min-width: 768px) 50vw, 100vw"
              className={styles.defaultImage}
              style={{ objectPosition: `${focalX}% ${focalY}%` }}
            />
          )}
        </div>
        <div className={styles.defaultBody}>
          {post.theme && <span className={styles.defaultTheme}>{post.theme}</span>}
          <Heading id={headingId} className={styles.defaultTitle}>
            {post.title}
          </Heading>
          <p className={styles.defaultDescription}>{post.description}</p>
          <span className={styles.defaultReadMore} aria-hidden="true">
            Les mer <span>→</span>
          </span>
        </div>
      </Link>
    </article>
  );
}
