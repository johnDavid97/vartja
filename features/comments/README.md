# Shared comments: posts and Program days

`components/comments/Comments.tsx` is the shared composer/thread UI. Its endpoint key prevents state from leaking between articles; Program keeps visited panels mounted so drafts and uncertain retries survive day switches. Nothing is persisted to browser storage. Full page reloads discard unfinished drafts.

## Boundaries

- Routes derive a typed target from the URL: `/api/posts/:postId/comments` or `/api/program-days/:dayId/comments`. Client JSON cannot choose the author, target, visibility or administrator identity.
- `source.ts` loads only the published guest-visible article/day. Private, unpublished and deleted posts return 404 even to administrators on the guest endpoint; administrators can still moderate retained records through the native admin collection.
- `validation.ts` owns target validation, scope predicates, replay fingerprint material and comment input/response types. Program fingerprints and the HMAC namespace are preserved, so requests from before the additive migration remain replay-compatible.
- `service.ts` shares pagination, same-target root replies, idempotency, explicit DTOs and moderation across both sources. Replies to hidden roots remain visible but cannot receive new replies until the root is restored.
- `features/guest-activity/` shares administrator/approved-household authentication, same-origin responses, durable author quotas and transaction locking. The original database quota table and hash namespace are intentionally retained. A user cannot reset the 20-writes/minute quota by switching between posts and Program.
- Native post saves/deletion, Program saves, and guest activity writes acquire the same transaction advisory lock. Publication/privacy changes cannot race accepted comment writes. This deliberately serializes writes for the small wedding site; revisit lock granularity if measured traffic warrants it.

## Admin controls and persistence

Posts have a native **Tillat kommentarer** checkbox with draft/publication semantics. Closing comments keeps existing discussion readable. The description links directly to filtered moderation and the published article for administrator replies. **Kommentarer** contains both source types with native filtering and shared table presentation.

The existing `program-comments` storage/API slug and historical `dayLabel` column remain stable, avoiding table renames and breaking old moderation links. `source` distinguishes posts from Program days. `postId` is a retained numeric target, not a cascading relationship: deleting an article does not erase its comment history or orphan replies. The database check permits exactly one valid target. Guest endpoints never expose deleted content; admins retain moderation access. Author, target and body fields cannot be changed through native CRUD.

## Migration and verification

Migration `20261118_194840_post_comments` adds post/target fields and the checkbox in both live posts and versions. Existing comments default to `program-day`; existing Program text, IDs, replies, moderation status and fingerprints are unchanged. Rollback refuses when post-comment records exist, requiring an explicit export/migration rather than deleting them.

`npm run test:post-comments` uses a disposable local database, checks rollback/reapplication and legacy comment preservation, then runs Program and post-comment browser tests. Coverage includes scope isolation, private/draft denial, author/scope immutability, native draft-aware controls, admin replies/moderation, exact lost-response retry, concurrent privacy changes, retained deleted-post history, quota enforcement and responsive layouts. Program activity and legacy poll suites also exercise the shared components.

Back up populated databases and apply only reviewed outstanding migrations. Never replay the initial migration against existing data.
