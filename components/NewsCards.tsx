import type { Post } from "@/payload-types";
import NewsCard from "@/components/NewsCard";

type NewsCardsProps = {
  posts: Post[];
  headingLevel?: "h2" | "h3";
};

export default function NewsCards({
  posts,
  headingLevel = "h2",
}: NewsCardsProps) {

  return (
    <div className="grid items-start gap-x-8 gap-y-12 md:grid-cols-2 xl:grid-cols-3">
      {posts.map((post) => (
        <NewsCard key={post.id} post={post} headingLevel={headingLevel} />
      ))}
    </div>
  );
}
