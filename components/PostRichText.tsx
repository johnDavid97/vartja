import Image from "next/image";
import { RichText, type JSXConvertersFunction } from "@payloadcms/richtext-lexical/react";
import type { Media, Post, ArticlePhotoBlock, ArticlePollBlock } from "@/payload-types";
import type { DefaultNodeTypes, SerializedBlockNode } from "@payloadcms/richtext-lexical";
import { editorTextSizes } from "@/lib/editor-text-sizes";
import { parsePoll } from "@/lib/polls";
import Poll from "@/components/Poll";

const converters = (postId?: number): JSXConvertersFunction<DefaultNodeTypes | SerializedBlockNode<ArticlePhotoBlock | ArticlePollBlock>> => ({ defaultConverters }) => ({
  ...defaultConverters,
  text: (args) => {
    const text = typeof defaultConverters.text === "function"
      ? defaultConverters.text(args)
      : args.node.text;
    const state = (args.node as typeof args.node & { $?: { size?: string } }).$;
    const size = state?.size;
    if (size && Object.hasOwn(editorTextSizes, size)) {
      const setting = editorTextSizes[size as keyof typeof editorTextSizes];
      return <span style={{ fontSize: setting.css["font-size"] }}>{text}</span>;
    }
    return text;
  },
  blocks: {
    poll: ({ node }) => {
      const poll = parsePoll(node.fields);
      return poll && postId ? <Poll key={poll.id} postId={postId} poll={poll} /> : null;
    },
    photo: ({ node }) => {
      const fields = node.fields as { image?: number | Media | null; alt?: string; caption?: string };
      const image = fields.image && typeof fields.image === "object" ? fields.image : null;
      if (!image?.url) return null;
      return (
        <figure className="my-8 space-y-3">
          <Image src={image.url} alt={fields.alt || image.alt} width={image.width || 1200} height={image.height || 900} unoptimized sizes="(min-width: 896px) 848px, 100vw" className="h-auto w-full" />
          {fields.caption && <figcaption className="text-sm text-stone-500">{fields.caption}</figcaption>}
        </figure>
      );
    },
  },
  upload: ({ node }) => {
    if (node.relationTo !== "media" || !node.value || typeof node.value !== "object") return null;
    const image = node.value as Media;
    if (!image.url) return null;
    const caption = typeof node.fields?.caption === "string" ? node.fields.caption : null;
    return (
      <figure className="my-8 space-y-3">
        <Image
          src={image.url}
          alt={image.alt}
          width={image.width || 1200}
          height={image.height || 900}
          unoptimized
          sizes="(min-width: 896px) 848px, 100vw"
          className="h-auto w-full"
        />
        {caption && <figcaption className="text-sm text-stone-500">{caption}</figcaption>}
      </figure>
    );
  },
});

export default function PostRichText({ data, postId }: { data: NonNullable<Post["body"]>; postId?: number }) {
  return (
    <RichText
      data={data}
      converters={converters(postId)}
      className="break-words text-base leading-relaxed text-stone-600 sm:text-lg [&_p]:my-5 [&_h2]:my-6 [&_h2]:font-serif [&_h2]:text-3xl [&_h2]:text-stone-900 [&_h3]:my-5 [&_h3]:font-serif [&_h3]:text-2xl [&_h3]:text-stone-900 [&_h4]:my-4 [&_h4]:text-xl [&_h4]:font-semibold [&_ul]:my-5 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-5 [&_ol]:list-decimal [&_ol]:pl-6 [&_a]:text-rose-800 [&_a]:underline [&_blockquote]:my-6 [&_blockquote]:border-l-2 [&_blockquote]:border-rose-300 [&_blockquote]:pl-5 [&_blockquote]:italic [&_hr]:my-8"
    />
  );
}
