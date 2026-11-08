import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import NewsCards from "@/components/NewsCards";
import { getPayload } from "payload";
import config from "@payload-config";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Innlegg — Andrea & Martin",
  description: "Nyheter og oppdateringer til bryllupsgjestene.",
};

type Props = {
  searchParams: Promise<{ page?: string | string[] }>;
};

async function Posts({ searchParams }: Props) {
  await connection();
  const { page: pageParam } = await searchParams;
  const requestedPage = Number(pageParam);
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0
    ? requestedPage
    : 1;
  const payload = await getPayload({ config });
  const posts = await payload.find({
    collection: "posts",
    overrideAccess: false,
    draft: false,
    sort: "-createdAt",
    limit: 9,
    page,
    depth: 1,
  });

  if (posts.docs.length === 0) {
    return (
      <Card className="mx-auto max-w-xl bg-white p-6 text-center sm:p-10">
        <CardHeader>
          <CardTitle>
            <h2 className="font-serif text-2xl">
              {page > 1 ? "Ingen innlegg på denne siden" : "Snart kommer det nytt fra oss"}
            </h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {page > 1 ? (
            <Link href="/news" className={buttonVariants({ variant: "outline" })}>
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
            <Link href={`/news?page=${page - 1}`} className={buttonVariants({ variant: "outline" })}>
              Forrige
            </Link>
          )}
          <p className="text-sm text-stone-600">Side {page} av {posts.totalPages}</p>
          {posts.hasNextPage && (
            <Link href={`/news?page=${page + 1}`} className={buttonVariants({ variant: "outline" })}>
              Neste
            </Link>
          )}
        </nav>
      )}
    </>
  );
}

export default function PostsPage({ searchParams }: Props) {
  return (
    <main className="min-h-svh px-4 py-12 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-7xl">
        <header className="mx-auto mb-12 max-w-2xl text-center sm:mb-16">
          <p className="mb-4 text-xs uppercase tracking-[0.2em] text-stone-500">Frem mot den store dagen</p>
          <h1 className="font-serif text-4xl text-stone-800 sm:text-6xl">Nytt fra oss</h1>
          <p className="mt-5 text-base leading-relaxed text-stone-600 sm:text-lg">
            Her finner dere nyheter, små oppdateringer og informasjon om bryllupet.
          </p>
        </header>
        <Suspense fallback={<p role="status" className="py-12 text-center text-stone-600">Laster innlegg…</p>}>
          <Posts searchParams={searchParams} />
        </Suspense>
      </div>
    </main>
  );
}
