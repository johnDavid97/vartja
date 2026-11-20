# VårtJa project conventions

Project-specific context. Read the sections relevant to the task; the general engineering agreement is in [engineering-guide.md](engineering-guide.md).

## Product and presentation

- Conversation defaults to English; application labels are Norwegian.
- Guest flows should be straightforward across ages and levels of technical experience. This is a product constraint, not a universal engineering rule.
- Follow the agreed PDF/screenshots and reuse the wedding site's visual identity and shared components.
- Date/time presentation follows the existing Norwegian / Europe/Oslo conventions.
- The current ordered backlog is [remaining-tasks.md](remaining-tasks.md). The agreed wedding address is `vårtja.no/andrea-og-martin`; see the [single-wedding routing boundary](../features/wedding-site/README.md). Full multi-wedding management is deferred.

## Framework and persistence

- Keep native Payload permissions, validation, form state, drafts and publication unless a specific approved requirement needs something different.
- Read the installed Next.js documentation before framework changes; this project's version may differ from familiar APIs.
- Preserve existing households, credentials, Program content/version history, posts, comments and votes. Use the disposable integration runners for data-writing tests.
- The populated local database has a legacy `dev` migration marker instead of records for the initial schema migrations. **Do not run a generic `payload migrate` against it:** that would try to replay existing initial tables. After backup, apply only the specifically reviewed outstanding migration and its migration record in one transaction. Fresh disposable databases use the full normal migration chain.

## Identity and privacy

- Administrators and guest households are separate identities. Email is contact information, not proof of identity. Real email delivery/recovery is deferred until explicitly designed.
- Approved guests can see guest content; private posts and drafts remain protected. Enforce privacy on APIs, data loaders and media, not just navigation.
- Preserve and securely back up `HOUSEHOLD_ACCESS_SECRET` alongside the database. Changing it requires a deliberate migration/recovery plan.

## Feature references

- [Wedding routing and legacy URL compatibility](../features/wedding-site/README.md)

- [Households](../features/households/README.md)
- [Program](../features/program/README.md)
- [Shared comments](../features/comments/README.md)
- [Polls](../features/polls/README.md)
- [Future considerations](future-considerations.md)
