import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { getPayload } from "payload";
import config from "@payload-config";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Nytt fra oss — Andrea & Martin",
};

type Props = { params: Promise<{ id: string }> };

async function Article({ params }: Props) {
  await connection();
  const { id } = await params;
  const postId = Number(id);
  if (!/^\d+$/.test(id) || !Number.isSafeInteger(postId) || postId < 1)
    notFound();

  const payload = await getPayload({ config });
  const { docs } = await payload.find({
    collection: "posts",
    where: { id: { equals: postId } },
    overrideAccess: false,
    draft: false,
    depth: 1,
    limit: 1,
  });
  const post = docs[0];
  if (!post) notFound();

  const photo = typeof post.photo === "object" ? post.photo : null;
  const paragraphs = post.description
    .split(/\r?\n\s*\r?\n/)
    .map((paragraph) => paragraph.replace(/\s*\r?\n\s*/g, " ").trim())
    .filter(Boolean);

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
      {photo?.url && (
        <Image
          src={photo.url}
          alt={photo.alt}
          width={photo.width || 1200}
          height={photo.height || 900}
          unoptimized
          sizes="(min-width: 896px) 848px, (min-width: 640px) calc(100vw - 48px), calc(100vw - 32px)"
          className="h-auto w-full"
        />
      )}
      <div className="space-y-5 text-left text-base leading-relaxed text-stone-600 sm:text-lg">
        {paragraphs.map((paragraph, index) => (
          <p key={index} className="break-words">
            {paragraph}
          </p>
        ))}
      </div>
    </article>
  );
}

export default function ArticlePage({ params }: Props) {
  return (
    <main className="min-h-svh px-4 py-8 sm:px-6 sm:py-16">
      <div className="mx-auto max-w-4xl">
        <Button variant="ghost" className="mb-6" render={<Link href="/news" />}>
          ← Alle innlegg
        </Button>
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
