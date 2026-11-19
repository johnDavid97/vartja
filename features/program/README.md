# Guest Program and per-day activity

The existing versioned Program global remains the source for itinerary, polls and comment settings. Published days render as accessible tabs with server-rendered timeline cards. All website and activity routes require an approved household or a separate Payload administrator; no draft flag is accepted from visitors.

## Editing

- `ProgramBuilder` owns the native Payload JSON field; `ProgramDayActivity` edits each day's optional `polls` and `commentsEnabled` settings. Existing itineraries need no backfill.
- `PollEditorFrame` is shared with the Lexical post editor. Native post fields and Program JSON retain their own persistence/validation adapters.
- Save draft/publish semantics apply to itinerary, polls and comment settings. Closing comments leaves existing discussion visible.
- Program polls appear alongside post polls in `/admin/polls`. Removed polls/days retain archived results using stored ballot definitions.

## Voting and comments

- New Program polls use one immutable ballot per household per day/poll across devices. Native administrators see results without voting. Legacy post/browser ballots are unchanged.
- `../guest-activity/transaction.ts` serializes Program/post saves and activity writes with a PostgreSQL transaction advisory lock. A voted poll's question, choices and day cannot change; closing/removing it is allowed. All supported writes must use the native Program hook or this transaction boundary.
- `../comments/validation.ts` contains bounded comment input validation and explicit response types. Comment authors come from the verified session, never client JSON. Responses expose only public display names, content and timestamps—not household IDs, email, request digests or credentials.
- Each day has independent comments and one level of replies. Parent comments must be visible roots on the same published day. Names resolve to the current household name, falling back to the name at submission after account deletion.
- Comment requests use author-scoped idempotency keys and content fingerprints. Visited day panels stay mounted, preserving drafts, reply selection and uncertain submissions for exact retry across day switches; unvisited days do not fetch comments. This state stays in memory, not browser storage, and does not survive a full page reload. All activity mutations require bounded same-origin JSON and a durable per-author quota of 20 writes/minute.
- Comments load in stable ID order, 50 per page with explicit continuation. Hidden comments become tombstones without their text/name; replies remain visible, but cannot offer new replies while their root comment is hidden.
- `/admin/collections/program-comments` reuses native list/filter/edit permissions and the shared table. Admins may hide/show comments but cannot rewrite authors, scope or guest text through CRUD. Reply and inline moderation controls live on the guest Program page for authenticated admins. Deleting a day removes guest access to its activity but retains moderation/history records.

## Verification and deployment

`npm run test:program-activity` builds, creates a disposable database, checks migration rollback/reapply, and runs Program plus activity browser/security tests. Unit coverage includes input validation, compatibility with existing itinerary JSON, and archived Program poll projection.

Migration `20261118_181836_program_day_activity` adds only activity tables and Payload lock relations. Back up populated databases and apply only outstanding reviewed migrations; never replay the initial migration. Existing Program JSON, version history and post votes are not transformed.

Post comments now reuse the same UI, identity, moderation and services; see [shared comments](../comments/README.md). Program endpoints remain restricted to their own day targets. Future work: guest comment editing/deletion, notification delivery, richer seat-count collection and measured scalability improvements.
