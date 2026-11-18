# Poll overview

`/admin/polls` is a read-only Payload admin view of existing post polls. It reuses the shared navigation, buttons, table frame, badges and post editor. It does not create another poll collection or change voting, drafts or permissions.

- `overview.ts`: pure projection and repository-injected loader.
- `PayloadPollOverviewRepository.ts`: authenticated admin adapter. Reads posts in 100-document batches with Payload access checks; aggregates ballot counts by post/poll/option in SQL without loading voter identifiers.
- `PollOverviewView.tsx`: explicitly requires an authenticated `users` administrator with admin access before reading data. Custom Payload views are not automatically protected. Uses the native default template.
- `PollOverview.tsx`: search, status filter, 20-row pagination, manual refresh, accessible native result dialog, and links back to the native post editor. Mobile keeps the shared horizontally scrollable table; result dialogs fit narrow screens.

## Data semantics

Published poll definitions take precedence over newer drafts. Closing or removing a poll in a draft cannot make the overview claim that public voting has already stopped. Those rows indicate unpublished poll changes. Draft-only polls are marked **Utkast**, not **Åpen**. Private posts are identified separately; an open private poll is not publicly accessible.

Polls removed from both current versions but retaining ballots appear as **Arkivert**, using their stored ballot definition. Unknown historical option IDs remain counted as **Tidligere svaralternativ**. Keys include both post and poll ID. Incomplete draft definitions are omitted until they have a valid question and options. Deleted posts retain the existing collection's vote-deletion policy; this feature does not alter it.

Counts are existing browser-based ballots, not household votes. No voter keys or identities reach the client. Results are a refreshable snapshot, not a live feed. This small-site implementation loads the complete overview for client-side search/pagination; if the content grows substantially, move those operations server-side rather than silently truncating posts or ballots.

The scaling follow-up is tracked in [Future considerations](../../docs/future-considerations.md).

## Verification

- `npm test`, TypeScript, lint and production build.
- `npm run test:poll-overview`: disposable database/server; tests empty state, real aggregation, unpublished changes versus live polls, private and archived polls, search/filter/pagination/refresh, keyboard dialog dismissal and focus return, editor navigation, anonymous denial and unchanged public voting.
- Responsive screenshots at 320, 390, 768, 1024 and 1440px for the overview and results.
- Runner also executes existing poll-editor/voting and native admin regression suites.

No migration is required. Nothing modifies existing posts or ballots while viewing the overview.

## Future comments design reference

The supplied `nettside-program.pdf` shows comments below Program, not only posts: initials avatars with display names, relative timestamps, indented replies, and a bottom comment composer. Reuse the shared identity/display-name presentation when implementing comments. Program comments, replies and guest authentication are future work, not part of this poll overview.
