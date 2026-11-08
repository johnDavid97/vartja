import Image from "next/image";
import type { Post } from "@/payload-types";
import PostRichText from "@/components/PostRichText";
import { getPostContent, splitParagraphs, type PostContentSource } from "@/lib/post-content";

export default function PostContent({ post }: { post: PostContentSource & Pick<Post, "body"> & { id?: number } }) {
  // An intentionally empty visual document stays empty; only absent documents fall back.
  if (post.body != null) return <PostRichText data={post.body} postId={post.id} />;

  return (
    <div className="space-y-8 sm:space-y-10">
      {getPostContent(post).map((block, index) => {
        const key = block.id || `${block.blockType}-${index}`;

        switch (block.blockType) {
          case "text":
            return (
              <section key={key} className="space-y-5 text-left text-base leading-relaxed text-stone-600 sm:text-lg">
                {block.heading && (
                  <h2 className="break-words font-serif text-2xl text-stone-900 sm:text-3xl">
                    {block.heading}
                  </h2>
                )}
                {splitParagraphs(block.text).map((paragraph, paragraphIndex) => (
                  <p key={paragraphIndex} className="break-words">{paragraph}</p>
                ))}
              </section>
            );
          case "image": {
            const image = typeof block.image === "object" ? block.image : null;
            // A deleted or inaccessible upload should not break the article.
            if (!image?.url) return null;

            return (
              <figure key={key} className="space-y-3">
                <Image
                  src={image.url}
                  alt={image.alt}
                  width={image.width || 1200}
                  height={image.height || 900}
                  unoptimized
                  sizes="(min-width: 896px) 848px, (min-width: 640px) calc(100vw - 48px), calc(100vw - 32px)"
                  className="h-auto w-full"
                />
                {block.caption && (
                  <figcaption className="break-words text-sm text-stone-500">{block.caption}</figcaption>
                )}
              </figure>
            );
          }
          default:
            return null;
        }
      })}
    </div>
  );
}
