import type { HomepageSettings } from "@/features/homepage/models";
import { formatWeddingDate } from "@/lib/wedding-date";
import styles from "./hero.module.css";

export default function SiteFooter({ settings }: { settings: HomepageSettings }) {
  return (
    <footer className={styles.footer}>
      <p>{settings.names}</p>
      <p>{formatWeddingDate(settings.date)}</p>
    </footer>
  );
}
