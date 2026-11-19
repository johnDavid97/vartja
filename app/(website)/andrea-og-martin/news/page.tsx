import type { Metadata } from "next";
import Link from "next/link";
import { requireApprovedViewer } from "@/features/households/auth/server";
import { publishedGuestPosts } from "@/features/households/auth/access";
import { withWebsiteAccess } from "@/components/households/withWebsiteAccess";
import { Suspense } from "react";
import NewsCards from "@/components/NewsCards";
import { getPayload } from "payload";
import config from "@payload-config";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import SiteFooter from "@/components/homepage/SiteFooter";
import { getHomepageSettings } from "@/features/homepage/composition-root";
import styles from "./news.module.css";
import { weddingPath } from "@/features/wedding-site/paths";
import { weddingPageMetadata } from "@/features/wedding-site/branding-server";

export async function generateMetadata(): Promise<Metadata> {
  return {
    ...await weddingPageMetadata("Innlegg"),
    description: "Nyheter og oppdateringer til bryllupsgjestene.",
  };
}

export default withWebsiteAccess(PostsPage);

type Props = {
  searchParams: Promise<{ page?: string | string[] }>;
};

async function Posts({ searchParams }: Props) {
  const viewer = await requireApprovedViewer();
  const { page: pageParam } = await searchParams;
  const requestedPage = Number(pageParam);
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0
    ? requestedPage
    : 1;
  const payload = await getPayload({ config });
  const posts = await payload.find({
    collection: "posts",
    req: viewer.req,
    where: publishedGuestPosts,
    overrideAccess: false,
    draft: false,
    sort: ["-publishedAt", "-id"],
    limit: 9,
    page,
    depth: 1,
  });

  if (posts.docs.length === 0) {
    return (
      <Card className="mx-auto max-w-xl bg-white p-6 text-center sm:p-10">
        <CardHeader>
          <CardTitle>
            <h2 className={`${styles.serifHeading} text-2xl`}>
              {page > 1 ? "Ingen innlegg på denne siden" : "Snart kommer det nytt fra oss"}
            </h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {page > 1 ? (
            <Link href={weddingPath("/news")} className={buttonVariants({ variant: "outline" })}>
              Til første side
            </Link>
          ) : (
            <p className="text-stone-600">Her deler vi oppdateringer frem mot den store dagen.</p>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <NewsCards posts={posts.docs} />

      {posts.totalPages > 1 && (
        <nav aria-label="Innleggssider" className="mt-12 flex flex-wrap items-center justify-center gap-4">
          {posts.hasPrevPage && (
            <Link href={`${weddingPath("/news")}?page=${page - 1}`} className={buttonVariants({ variant: "outline" })}>
              Forrige
            </Link>
          )}
          <p className="text-sm text-stone-600">Side {page} av {posts.totalPages}</p>
          {posts.hasNextPage && (
            <Link href={`${weddingPath("/news")}?page=${page + 1}`} className={buttonVariants({ variant: "outline" })}>
              Neste
            </Link>
          )}
        </nav>
      )}
    </>
  );
}

async function WebsiteFooter() {
  await requireApprovedViewer();
  return <SiteFooter settings={await getHomepageSettings()} />;
}

function PostsPage({ searchParams }: Props) {
  return (
    <>
      <main className="min-h-svh px-4 py-12 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-7xl">
          <header className="mb-12 text-center sm:mb-16">
            <h1 className={`${styles.serifHeading} text-4xl text-stone-800 sm:text-6xl`}>Innlegg</h1>
          </header>
          <Suspense fallback={<p role="status" className="py-12 text-center text-stone-600">Laster innlegg…</p>}>
            <Posts searchParams={searchParams} />
          </Suspense>
        </div>
      </main>
      <Suspense fallback={null}>
        <WebsiteFooter />
      </Suspense>
    </>
  );
}
