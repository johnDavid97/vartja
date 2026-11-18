# Future considerations

Deferred work and non-blocking limitations to revisit as the website evolves. Items below distinguish agreed future work from possible improvements.

## Poll overview: server-side filtering and pagination

**Current behaviour:** The overview loads all relevant posts and aggregated poll results on the server, then sends the complete overview to the browser for search, filtering and pagination. Posts are fetched in batches, but those batches are combined in memory; displaying 20 rows per page does not limit the total data loaded.

**Why this is acceptable now:** The wedding website is expected to have a small number of posts and polls. Ballots are aggregated in the database; individual votes and voter identifiers are not sent to the browser.

**When to revisit:** If the number of posts or polls grows substantially, or measurements show slow overview loading, large response payloads or excessive server/browser memory use.

**Possible next step:** Move search, status filtering and pagination to the server, returning only the requested page and matching total. Consider an indexed poll projection if extracting polls from post bodies becomes expensive. Do not silently cap the data and show incomplete results.

**Preserve:** Administrator-only access, published-versus-draft distinctions, archived results, and accurate vote totals. Add tests covering multiple pages and filtering across the full dataset.

Implementation details: [Poll overview](../features/polls/README.md).

## Email delivery and household access recovery

**Agreed future work:** Configure transactional email delivery and a verified sending domain, then implement secure household access recovery using the household's contact email. Email is contact/recovery information, not the proposed login identifier; login will use the household name and access code.

**Until then:** Recovery is administrator-assisted. Do not offer a reset-email flow that cannot deliver messages, or treat knowledge of an email address as proof of identity.

**Before enabling self-service recovery:** Verify control of the recovery address, use short-lived single-use recovery links, apply rate limits and non-enumerating responses, and define session revocation after recovery. Address changes also need a safe verification policy. Keep existing code-rotation auditing and never send existing access codes in plaintext email.

## Guest sessions and post-wedding photo access

**Agreed direction:** Remember household logins beyond the wedding so guests can return for photos, independently on each browser/device. Session expiry must not delete accounts or remove photo access; guests can log in again.

**Implemented:** Remembered sessions last 12 calendar months per browser/device; non-remembered sessions last at most 24 hours. Logout, loss of approval and code replacement invalidate access. Expiry never deletes the household or its photos.

## Agreed household login and naming direction

- Login uses a household/family name plus its existing access code, rather than email or an additional password.
- Provide a prefilled, editable household display-name suggestion during registration; administrators can also set it for households they create. Accepting the suggestion should need no extra typing. Guests may choose their own name instead.
- Comments show the household display name and initials, not an individually selected member.
- Only the homepage's public photo, title and welcome content remain visible without login. Hide posts and protected navigation for anonymous visitors, and enforce access on pages, APIs and private media—not just navigation.
- Pending households may log in to see a waiting-for-approval message, but cannot access private content or comment.
- Name changes affect subsequent logins but preserve existing sessions. Duplicate names are allowed; access codes distinguish households. Login ignores casing and all whitespace while preserving the displayed name.

Household login, guest sessions and guest-content protection are implemented. Comments, guest self-service editing and email recovery remain future work. Before public deployment, add trusted-ingress rate limiting: the durable global login quota intentionally bounds work but can be exhausted to temporarily deny legitimate logins.
