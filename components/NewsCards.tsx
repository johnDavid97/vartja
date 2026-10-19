import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { Post } from "@/payload-types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type NewsCardsProps = {
  posts: Post[];
  headingLevel?: "h2" | "h3";
};

export default function NewsCards({ posts, headingLevel = "h2" }: NewsCardsProps) {
  const Heading = headingLevel;

  return (
    <div className="grid items-start gap-x-8 gap-y-12 md:grid-cols-2 xl:grid-cols-3">
      {posts.map((post) => {
        const photo = typeof post.photo === "object" ? post.photo : null;

        return (
          <article key={post.id} className="min-w-0" aria-labelledby={`post-${post.id}`}>
            <Link
              href={`/news/${post.id}`}
              className="group block focus-visible:outline-2 focus-visible:outline-offset-8 focus-visible:outline-rose-700"
            >
              {photo?.url && (
                <div className="relative aspect-[4/3] overflow-hidden bg-stone-100">
                  <Image
                    src={photo.url}
                    alt={photo.alt}
                    fill
                    unoptimized
                    sizes="(min-width: 1280px) 400px, (min-width: 768px) 50vw, 100vw"
                    className="object-cover motion-safe:transition-transform motion-safe:duration-300 motion-safe:group-hover:scale-[1.03]"
                  />
                </div>
              )}
              <Card className="gap-3 overflow-visible rounded-none bg-transparent py-6 shadow-none ring-0">
                <CardHeader className="px-0">
                  {post.theme && (
                    <span className="mb-3 w-fit max-w-full break-words rounded-full bg-rose-100 px-4 py-1.5 text-sm font-semibold text-rose-900 ring-1 ring-inset ring-rose-200">
                      {post.theme}
                    </span>
                  )}
                  <CardTitle className="flex items-start justify-between gap-4">
                    <Heading id={`post-${post.id}`} className="min-w-0 break-words font-serif text-2xl leading-snug text-stone-800 group-hover:underline group-hover:decoration-1 group-hover:underline-offset-4">
                      {post.title}
                    </Heading>
                    <ArrowUpRight className="mt-1 size-5 shrink-0 text-stone-700" aria-hidden="true" />
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-0">
                  <p className="line-clamp-3 whitespace-pre-line break-words text-base leading-relaxed text-stone-600">
                    {post.description}
                  </p>
                </CardContent>
              </Card>
            </Link>
          </article>
        );
      })}
    </div>
  );
}
