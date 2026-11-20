import type { Metadata } from "next";
import { geistSans, weddingSerif } from "@/app/fonts";
import { vartjaIcons } from "@/features/wedding-site/icons";
import styles from "./landing.module.css";

export const metadata: Metadata = {
  title: "VårtJa · Personlige bryllupsnettsider",
  description: "En personlig nettside for bryllupet deres. Samle program, praktisk informasjon og oppdateringer på ett sted for gjestene.",
  icons: vartjaIcons,
};

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nb" className={`${geistSans.variable} ${weddingSerif.variable}`}>
      <body className={styles.body}>
        <a className={styles.skip} href="#hovedinnhold">Hopp til innhold</a>
        {children}
      </body>
    </html>
  );
}
