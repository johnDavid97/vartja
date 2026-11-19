# Engineering working agreement

General principles for contributors. Project-specific requirements belong in separate architecture/product notes, not in this guide. Read the documentation relevant to the assigned task.

## Collaboration

- Work on one agreed feature at a time. Keep updates concise, concrete and easy to scan.
- Ask focused questions when behaviour, designs or scope are unclear. Do not guess missing requirements.
- Follow supplied references and the established visual language. Inspect the reference before implementing.
- Keep scope explicit. Fix the requested problem without silently introducing unrelated features or redesigns.

## Architecture and code quality

- Use strict types, descriptive names and explicit boundary contracts. Validate untrusted inputs on the server; client validation is a convenience.
- Keep responsibilities focused. Separate domain rules, application coordination, persistence/HTTP adapters and presentation where those boundaries help.
- Prefer pure functions for validation and transformations. Keep database, network and framework IO outside them.
- Use OOP where it earns its place: cohesive services/repositories with constructor-injected dependencies for storage, clocks, tokens and external services. Production composition roots wire dependencies; tests can use fakes.
- Do not force classes, inheritance, interfaces or elaborate layers onto simple functions. Favour composition over inheritance and avoid speculative abstractions.
- Reuse real common responsibilities instead of copy/paste. Keep adapter-specific state and persistence behaviour where it belongs.
- Keep functions and components readable. Extract meaningful responsibilities, not arbitrary fragments just to reduce line counts. Explain safety decisions rather than narrating obvious code.
- Prefer supported framework/platform capabilities over competing custom implementations. Consult documentation for the installed versions rather than relying on remembered APIs.

## UI and accessibility

- Reuse established components, design tokens, colours and typography.
- Make persistence and immediate actions clear. Preserve the difference between unpublished edits and changes users can already see.
- Preserve unfinished form state and exact retry requests where responses can be lost. Avoid duplicate submissions and accidental draft loss during navigation.
- Test real keyboard interaction, labels, focus, loading/error/empty states and responsive layouts. Inspect screenshots as well as assertions.
- Use explicitly agreed locale and timezone conventions rather than incidental environment defaults.

## Security and data

- Enforce authorization at every relevant entry point. Hidden links are not access control.
- Derive identity and ownership on the server. Return explicit response models rather than raw records containing unrelated or sensitive fields.
- Use bounded inputs, appropriate CSRF protection, durable throttling and non-enumerating authentication errors.
- Design writes for concurrency and uncertain retries. Use transactions, unique constraints, version checks or locks according to the actual invariant.
- Preserve existing data and history. Back up populated databases, review migrations and verify preservation. Never replay initial migrations against populated databases.
- Test migration chains and rollback in disposable databases. Refuse destructive rollback when newer data requires an explicit migration/export plan.
- Never print or commit environment secrets, credentials, database backups or real user data. Treat encryption-key rotation and recovery as deliberate operational procedures.

## Verification and delivery

- Use feature branches. Do not commit, merge or push without explicit approval for that work.
- Run relevant unit tests, type checks, build, lint and integration/browser checks. Exercise security boundaries and regressions, not only the happy path or static markup.
- Use disposable environments for tests that mutate data. Never overwrite real content with fixtures.
- Check the staged diff too: untracked files are not covered by an unstaged `git diff --check`.
- Report what actually passed, failed or timed out. Distinguish existing warnings from new issues. Incomplete reviews are not successful reviews.
- After an approved delivery, confirm branch state and working-tree cleanliness. Do not bundle unrelated user changes.
