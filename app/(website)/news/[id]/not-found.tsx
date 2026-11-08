import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function ArticleNotFound() {
  return (
    <div className="px-6 py-20 text-center">
      <h1 className="font-serif text-3xl">Fant ikke innlegget</h1>
      <p className="mt-4 text-stone-600">Innlegget finnes ikke eller er ikke publisert.</p>
      <Link href="/news" className={buttonVariants({ variant: "outline", className: "mt-6" })}>
        Se alle innlegg
      </Link>
    </div>
  );
}
