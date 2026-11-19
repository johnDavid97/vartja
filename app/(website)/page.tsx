import { Suspense } from "react";
import { getWebsiteViewer } from "@/features/households/auth/server";
import { connection } from "next/server";
import WeddingHero from "@/components/homepage/WeddingHero";
import LatestUpdates from "@/components/homepage/LatestUpdates";
import SiteFooter from "@/components/homepage/SiteFooter";
import {
  getHomepageSettings,
  getHomepageUpdates,
} from "@/features/homepage/composition-root";

async function WeddingHomepage() {
  await connection();
  const [settings, viewer] = await Promise.all([
    getHomepageSettings(),
    getWebsiteViewer(),
  ]);
  const approved =
    viewer.administrator || viewer.household?.status === "approved";
  const posts = approved ? await getHomepageUpdates() : [];
  return (
    <>
      <main>
        <WeddingHero settings={settings} />
        {approved && <LatestUpdates posts={posts} />}
      </main>
      <SiteFooter settings={settings} />
    </>
  );
}

export default function Home() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-[70svh] items-center justify-center">
          <p>Laster bryllupsnettsiden…</p>
        </main>
      }
    >
      <WeddingHomepage />
    </Suspense>
  );
}
