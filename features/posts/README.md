# Guest posts presentation

Design reference: `Nettside-innlegg.pdf`. The approved scope covers the individual article, the Innlegg overview using the same cards as **Flere innlegg**, and shared guest poll/comment styling on both posts and Program.

## Routes and shared components

- `app/(website)/news/page.tsx`: nine-card paginated overview, newest publication date first with descending ID as a stable tie-break. Invalid page inputs fall back to page one; empty and out-of-range pages retain useful navigation.
- `app/(website)/news/[id]/page.tsx`: category/date, wedding-font title, description, optional focal-point cover, authored content, shared comments, then up to three newest other posts. No related section is fabricated when there are no other eligible posts. Invalid/out-of-range numeric IDs return not found.
- `components/NewsCard.tsx` / `NewsCards.tsx`: shared default cards for the overview and related section. Missing covers retain a muted decorative media area; article pages omit missing covers. The existing homepage variant/carousel is not redesigned.
- `news.module.css`: route-local wedding-font headings; it does not change global or authored typography.
- `lib/article-date.ts`: Norwegian/Oslo display dates, with creation date as a display fallback for absent/invalid legacy publication dates. Query ordering remains publication date, then ID, as on the intended publishing flow; this is not a new scheduled-publishing feature.
- Both routes reuse the configured wedding footer. PDF sample names, dates, signatures and copy are never injected into saved posts.

## Privacy and legacy content

Every read requires an approved household or native administrator, forwards the request identity with `overrideAccess: false`, uses `draft: false`, and explicitly applies `publishedGuestPosts`. Administrators do not see private/draft content through guest-facing cards or article routes. Related queries exclude the current ID. Newer unpublished revisions never replace the published article/card content.

The article lookup passes local API context `skipLegacyBodyConversion: true`. `Posts.afterRead` then leaves a missing legacy body untouched instead of synthesizing a second cover/description. The article header renders those fields once; `PostContent` receives `fallbackToSummary={false}` and renders only actual authored rich text or legacy content blocks. Ordinary API/admin reads still use the existing legacy editor adapter. `articleContentAfterCover` applies one display-only exception: when a usable cover is rendered, an identical uncaptioned image at the very start of the body is omitted from that render. It handles legacy uploads, photo blocks and old image blocks without mutating saved content. Captioned images, photo blocks with a different custom alt description, and repetitions later in the body remain untouched. Formatting and intentionally empty bodies are preserved; no content migration is performed.

Rich-text typography remains unchanged, including nested lists. Embedded poll styles override article typography within the poll only.

## Shared activity

`components/Poll.tsx` and `poll.module.css` provide the compact card and in-row result fills. Voting remains native radio selection followed by **Stem**, not immediate submission when an answer is clicked. Existing result visibility, closed/read-only states, errors and retries remain. Historical post ballots are still browser-based; Program ballots remain household-based. No fabricated deadlines or poll-description fields were added.

`components/comments/Comments.tsx` and `comments.module.css` provide compact threads, indented replies and a multiline composer. Relative timestamps use an effect-initialized client clock and retain a full Oslo timestamp in the time tooltip. Counts describe loaded entries, with `+` while more pages exist, rather than pretending to be a total. See [shared comments](../comments/README.md) for unchanged retry, moderation and identity rules.

## Verification

`npm run test:posts-design` builds and uses a disposable database/server on port 3111. It covers guest/admin boundaries, unpublished revisions, invalid IDs, ordering/ties, pagination, no-cover/long-text cards, related exclusion, raw legacy rendering, authored repetition/nested lists, configured footer, responsive layouts and unchanged post/version fingerprints.

Verified: 301 unit tests across 40 files, 14 browser smoke checks, build, TypeScript, and disposable posts-design, homepage, post-comments, Program-activity, native admin, visual-editor and poll regressions. Lint has only four existing initial-migration warnings. Independent review found no remaining blockers.

Also run the homepage, post-comments, Program-activity, visual-editor/poll and browser smoke regressions when changing shared components. Screenshots cover 320, 390, 768 and 1440px. Database-writing tests run only in disposable databases; this feature requires no migration and does not modify real wedding content or existing votes/comments.
