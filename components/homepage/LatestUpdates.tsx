import type { Post } from "@/payload-types";
import NewsCard from "@/components/NewsCard";
import UpdatesCarousel from "./UpdatesCarousel";
import styles from "./updates.module.css";

type LatestUpdatesProps = {
  posts: Post[];
};

export default function LatestUpdates({ posts }: LatestUpdatesProps) {
  return (
    <section className={styles.section} aria-labelledby="latest-updates-heading">
      <div className={styles.inner}>
        <header className={styles.headingGroup}>
          <p className={styles.eyebrow}>OPPDATERINGER</p>
          <h2 id="latest-updates-heading" className={styles.heading}>
            Siste nytt fra oss
          </h2>
        </header>

        {posts.length === 0 ? (
          <p className={styles.empty}>Det er ingen oppdateringer ennå.</p>
        ) : (
          <UpdatesCarousel>
            {posts.map((post) => <NewsCard key={post.id} post={post} headingLevel="h3" variant="homepage" />)}
          </UpdatesCarousel>
        )}
      </div>
    </section>
  );
}
