# How we build VårtJa

This is the shared working agreement for contributors. Read it before planning or changing code, together with the relevant feature README. Update it when a different approach is agreed; keep durable decisions in the project documentation.

## Working with the user

- Work on one agreed feature at a time. Keep updates concise, concrete and easy to scan.
- Use English in conversation unless requested otherwise; application labels are Norwegian.
- Ask focused questions when behaviour, designs or scope are unclear. Do not invent missing designs or interpret an ambiguous URL/domain requirement as a settled architecture decision.
- Guest UX must be especially simple for children, older guests and less technical people.
- Follow the supplied PDF/screenshots and existing visual language. Check the reference before building, not only after.

## Architecture and code quality

- Use strict TypeScript, descriptive names and explicit boundary types. Validate untrusted inputs at the server boundary; client validation is only a convenience.
- Keep responsibilities focused. Separate domain rules, application coordination, persistence/HTTP adapters and presentation when those boundaries are useful.
- Prefer pure, testable functions for validation and transformations. Keep database, network and framework IO outside them.
- Use OOP where it earns its place: services/repositories with cohesive responsibilities and constructor-injected dependencies for storage, clocks, tokens and external services. Production composition roots wire those dependencies; tests can use fakes.
- Do not force classes, inheritance, interfaces or an elaborate architecture onto simple functions. Favour composition over inheritance and avoid speculative abstractions.
- Reuse shared UI and domain behaviour instead of copy/paste. Share the real common responsibility while allowing native Payload fields and other adapters to retain their own state/persistence rules.
- Keep functions and components readable. Extract genuinely separate responsibilities, not arbitrary fragments just to reduce line counts. Explain safety decisions rather than narrating obvious code.
- Prefer native Payload permissions, validation, drafts, publication, form state and accessible controls over parallel custom implementations.
- Read the relevant installed Next.js guides before writing Next-specific code. Do not assume remembered APIs match this repository's version.

## UI and accessibility

- Reuse existing colours, typography, buttons, tables, poll presentation and household identity components.
- Keep editing/publishing actions explicit. A saved draft must not silently change what guests see. Clearly distinguish immediate operations such as credential rotation and moderation.
- Preserve unfinished form state and exact retry requests where a response can be lost. Do not accidentally duplicate submissions or discard drafts when switching tabs.
- Test real keyboard interaction, labels, focus, loading/error/empty states and mobile layouts, including narrow 320px screens. Inspect screenshots as well as assertions.
- Use the established Norwegian/Oslo date conventions, not the server or browser's incidental timezone.

## Security and existing data

- Administrator accounts and household identities are separate. Email is contact information, not proof of identity. Do not add real email delivery without an agreed delivery/recovery design.
- Enforce authorization on pages, data loaders, APIs and media delivery. Hidden links are not access control. Preserve private-post and draft restrictions.
- Derive identity and ownership on the server. Return explicit guest DTOs rather than raw records containing contact information, secrets or internal identifiers.
- Use bounded request bodies, same-origin mutation checks, durable throttling and generic authentication errors where appropriate.
- Design writes for concurrency and uncertain retries. Use transactions, unique constraints, version checks or locks according to the actual invariant; do not rely on an in-memory check alone.
- Preserve existing households, credentials, Program content/history, posts and votes. Back up populated databases before schema changes, review additive migrations, and verify preservation.
- Never replay initial migrations against a populated development database. Test migration chains/rollback/reapply only in disposable databases. Refuse destructive rollback when new records need explicit export/migration.
- Never print or commit `.env`, credential secrets, database backups or real guest data. Back up `HOUSEHOLD_ACCESS_SECRET` securely with the database; changing it requires a deliberate migration plan.

## Verification and delivery

- Use feature branches. Do not commit, merge or push without explicit user approval for that work.
- Before proposing completion, run relevant unit tests, TypeScript, build, lint and integration/browser checks. Exercise security boundaries and regressions, not just the happy path or static markup.
- Use disposable database runners for tests that write data. Never replace a real itinerary or version history with fixtures.
- Check the staged diff too: untracked files are not covered by an unstaged `git diff --check`.
- Report what actually passed, failed or timed out. Distinguish pre-existing warnings from new problems. Do not describe incomplete reviews as successful.
- After an approved merge/push, confirm branch state and working-tree cleanliness. Do not bundle unrelated user changes.


## Starting points

- Current task order: [remaining tasks](remaining-tasks.md).
- Household authentication and persistence: [`features/households/README.md`](../features/households/README.md).
- Program and activity: [`features/program/README.md`](../features/program/README.md).
- Shared post/Program comments: [`features/comments/README.md`](../features/comments/README.md).
- Polls: [`features/polls/README.md`](../features/polls/README.md).
- Deferred decisions and scaling considerations: [future considerations](future-considerations.md).
