import { Suspense } from "react";
import NewsCards from "@/components/NewsCards";
import { connection } from "next/server";
import { getPayload } from "payload";
import config from "@payload-config";
import WeddingCountdown from "@/components/WeddingCountdown";

async function WeddingHomepage() {
  // Read fresh published content for each visit, never an editor's draft.
  await connection();
  const payload = await getPayload({ config });
  const [wedding, posts] = await Promise.all([
    payload.findGlobal({ slug: "wedding", overrideAccess: false }),
    payload.find({
      collection: "posts",
      overrideAccess: false,
      draft: false,
      sort: "-createdAt",
      limit: 12,
      depth: 1,
    }),
  ]);

  const names = wedding.coupleNames || "Andrea & Martin";
  const date = wedding.weddingDate || "2027-07-27T00:00:00+02:00";

  return (
    <>
      <section className="flex min-h-svh snap-start flex-col items-center justify-center px-4 py-12 text-center sm:px-6 sm:py-16">
        <h1 className="whitespace-pre-line font-serif text-5xl leading-tight sm:text-7xl md:text-8xl">
          {names.replace(" & ", " &\n")}
        </h1>
        <WeddingCountdown date={date} />
      </section>

      {posts.docs.length > 0 && (
        <section className="min-h-svh snap-start border-t border-stone-200 px-4 py-16 sm:px-6 sm:py-24">
          <div className="mx-auto max-w-7xl">
            <h2 className="mb-10 text-center font-serif text-4xl">
              Nytt fra oss
            </h2>
            <NewsCards posts={posts.docs} headingLevel="h3" />
          </div>
        </section>
      )}
    </>
  );
}

export default function Home() {
  return (
    <main className="h-svh overflow-y-auto snap-y snap-proximity motion-safe:scroll-smooth">
      <Suspense
        fallback={
          <p className="flex min-h-svh items-center justify-center text-stone-600">
            Laster bryllupsnettsiden…
          </p>
        }
      >
        <WeddingHomepage />
      </Suspense>
    </main>
  );
}
