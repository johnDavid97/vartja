import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getPayload } from "payload";
import config from "@payload-config";
import PostContent from "@/components/PostContent";
import NewsCards from "@/components/NewsCards";
import SiteFooter from "@/components/homepage/SiteFooter";
import { Comments } from "@/components/comments/Comments";
import { withWebsiteAccess } from "@/components/households/withWebsiteAccess";
import { buttonVariants } from "@/components/ui/button";
import { publishedGuestPosts } from "@/features/households/auth/access";
import { requireApprovedViewer } from "@/features/households/auth/server";
import { getHomepageSettings } from "@/features/homepage/composition-root";
import { articleDate } from "@/lib/article-date";
import { articleContentAfterCover } from "@/lib/article-content";
import styles from "../news.module.css";
import { weddingPath } from "@/features/wedding-site/paths";
import { weddingPageMetadata } from "@/features/wedding-site/branding-server";

// Do not expose private/draft article titles through public metadata.
export async function generateMetadata(): Promise<Metadata> {
  return weddingPageMetadata("Innlegg");
}

export default withWebsiteAccess(ArticlePage);

type Props = { params: Promise<{ id: string }> };

const POSTGRES_SERIAL_MAX = 2_147_483_647;

async function Article({ params }: Props) {
  const viewer = await requireApprovedViewer();
  const { id } = await params;
  const postId = Number(id);
  if (!/^\d+$/.test(id) || !Number.isSafeInteger(postId) || postId < 1 || postId > POSTGRES_SERIAL_MAX) notFound();

  const payload = await getPayload({ config });
  const { docs } = await payload.find({
    collection: "posts",
    where: { and: [{ id: { equals: postId } }, publishedGuestPosts] },
    req: viewer.req,
    overrideAccess: false,
    draft: false,
    context: { skipLegacyBodyConversion: true },
    depth: 1,
    limit: 1,
  });
  const post = docs[0];
  if (!post) notFound();

  const [related, settings] = await Promise.all([
    payload.find({
      collection: "posts",
      where: { and: [{ id: { not_equals: postId } }, publishedGuestPosts] },
      req: viewer.req,
      overrideAccess: false,
      draft: false,
      sort: ["-publishedAt", "-id"],
      depth: 1,
      limit: 3,
    }),
    getHomepageSettings(),
  ]);
  const displayedDate = articleDate(post.publishedAt, post.createdAt);
  const cover = typeof post.photo === "object" ? post.photo : null;
  const focalX = cover?.focalX ?? 50;
  const focalY = cover?.focalY ?? 50;
  const articleContent = articleContentAfterCover(post);
  const hasArticleBody = articleContent.body != null
    ? articleContent.body.root.children.length > 0
    : Boolean(articleContent.content?.length);

  return (
    <>
      <main className="min-h-svh px-4 py-8 sm:px-6 sm:py-16">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-4xl">
            <div className="mx-auto max-w-3xl">
              <Link href={weddingPath("/news")} className={buttonVariants({ variant: "ghost", className: "mb-8" })}>
                ← Alle innlegg
              </Link>
            </div>
            <article aria-labelledby="article-title" className="space-y-8 sm:space-y-10">
              <header className="text-center">
                {(post.theme || displayedDate) && (
                  <div className="mb-5 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm text-stone-500">
                    {post.theme && (
                      <span className="max-w-full break-words rounded-full bg-[#edf3f0] px-4 py-1.5 font-semibold text-[#2e5e53]">
                        {post.theme}
                      </span>
                    )}
                    {displayedDate && <time dateTime={displayedDate.iso}>{displayedDate.label}</time>}
                  </div>
                )}
                <h1 id="article-title" className={`${styles.serifHeading} text-balance break-words text-4xl font-normal leading-[1.08] tracking-tight text-stone-900 sm:text-5xl lg:text-6xl`}>
                  {post.title}
                </h1>
                <p className="mx-auto mt-6 max-w-3xl whitespace-pre-line break-words text-lg leading-relaxed text-stone-600 sm:text-xl">
                  {post.description}
                </p>
              </header>

              {cover?.url && (
                <div className="relative aspect-[3/2] overflow-hidden rounded-2xl bg-stone-100">
                  <Image
                    src={cover.url}
                    alt={cover.alt}
                    fill
                    unoptimized
                    sizes="(min-width: 896px) 848px, (min-width: 640px) calc(100vw - 48px), calc(100vw - 32px)"
                    className="object-cover"
                    style={{ objectPosition: `${focalX}% ${focalY}%` }}
                  />
                </div>
              )}

              <div className="mx-auto w-full max-w-3xl space-y-8 sm:space-y-10">
                {hasArticleBody && (
                  <section aria-label="Artikkelinnhold">
                    <PostContent post={articleContent} fallbackToSummary={false} />
                  </section>
                )}

                <Comments
                  endpoint={`/api/posts/${post.id}/comments`}
                  authorName={viewer.administrator ? viewer.req.user?.name || "Brudeparet" : viewer.household!.displayName}
                  administrator={viewer.administrator}
                />
              </div>
            </article>
          </div>

          {related.docs.length > 0 && (
            <section aria-labelledby="related-posts-heading" className="mt-16 border-t border-stone-200 pt-12 sm:mt-24 sm:pt-16">
              <h2 id="related-posts-heading" className={`${styles.serifHeading} mb-8 text-center text-4xl font-normal text-stone-900 sm:mb-10 sm:text-5xl`}>
                Flere innlegg
              </h2>
              <NewsCards posts={related.docs} headingLevel="h3" />
            </section>
          )}
        </div>
      </main>
      <SiteFooter settings={settings} />
    </>
  );
}

function ArticlePage({ params }: Props) {
  return (
    <Suspense
      fallback={
        <main className="min-h-svh px-4 py-16 text-center sm:px-6">
          <p role="status" className="text-stone-600">Laster innlegget…</p>
        </main>
      }
    >
      <Article params={params} />
    </Suspense>
  );
}
