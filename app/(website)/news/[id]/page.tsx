import type { Metadata } from "next";
import PostContent from "@/components/PostContent";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireApprovedViewer } from "@/features/households/auth/server";
import { publishedGuestPosts } from "@/features/households/auth/access";
import { withWebsiteAccess } from "@/components/households/withWebsiteAccess";
import { Suspense } from "react";
import { getPayload } from "payload";
import config from "@payload-config";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Nytt fra oss — Andrea & Martin",
};

export default withWebsiteAccess(ArticlePage);

type Props = { params: Promise<{ id: string }> };

async function Article({ params }: Props) {
  const viewer = await requireApprovedViewer();
  const { id } = await params;
  const postId = Number(id);
  if (!/^\d+$/.test(id) || !Number.isSafeInteger(postId) || postId < 1)
    notFound();

  const payload = await getPayload({ config });
  const { docs } = await payload.find({
    collection: "posts",
    where: { and: [{ id: { equals: postId } }, publishedGuestPosts] },
    req: viewer.req,
    overrideAccess: false,
    draft: false,
    depth: 1,
    limit: 1,
  });
  const post = docs[0];
  if (!post) notFound();

  return (
    <article className="space-y-8 sm:space-y-10">
      <header className="text-center">
        {(post.theme || post.publishedAt) && (
          <div className="mb-5 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm text-stone-500">
            {post.theme && (
              <span className="max-w-full break-words rounded-full bg-rose-100 px-4 py-1.5 text-sm font-semibold text-rose-900 ring-1 ring-inset ring-rose-200">
                {post.theme}
              </span>
            )}
            {post.publishedAt && (
              <time dateTime={post.publishedAt}>
                {new Date(post.publishedAt).toLocaleDateString("nb-NO", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                  timeZone: "Europe/Oslo",
                })}
              </time>
            )}
          </div>
        )}
        <h1 className="text-balance break-words text-4xl font-medium italic leading-[1.15] tracking-tight text-stone-900 sm:text-5xl lg:text-6xl">
          {post.title}
        </h1>
      </header>
      <PostContent post={post} />
    </article>
  );
}

function ArticlePage({ params }: Props) {
  return (
    <main className="min-h-svh px-4 py-8 sm:px-6 sm:py-16">
      <div className="mx-auto max-w-4xl">
        <Link href="/news" className={buttonVariants({ variant: "ghost", className: "mb-6" })}>
          ← Alle innlegg
        </Link>
        <Suspense
          fallback={
            <p role="status" className="py-16 text-center text-stone-600">
              Laster innlegget…
            </p>
          }
        >
          <Article params={params} />
        </Suspense>
      </div>
    </main>
  );
}
