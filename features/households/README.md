# Reading the household code

Registration, database storage, admin approval/creation, household overview, shared invitations, guest login and site privacy are connected. Household self-service remains pending. Posts and per-day Program comments use the shared household identity; see [shared comments](../comments/README.md).

## Guest authentication

`auth/HouseholdAuthService.ts` coordinates injected session storage, credentials, clock, limiter and token generation. `auth/validation.ts` ignores casing and whitespace for login names without altering display names. Duplicate names are distinguished by the existing access code.

Opaque session tokens are stored only as digests. Remembered sessions last 12 calendar months per device; session cookies otherwise expire server-side after 24 hours. Live household status and credential/session versions enforce revocation. Renaming preserves sessions; replacing codes, withdrawing approval and logout invalidate access. Pending households see only the waiting page.

`auth/server.ts` protects server-rendered pages and loaders; `auth/access.ts` protects Payload reads and media. Only the selected homepage hero image is anonymous; approved households can read guest media and published guest posts, not administrator-only posts. Media is shared among approved households, not a separate administrator-confidential file store. Native administrator authentication remains separate. Do not serve uploads directly through a static web server/CDN that bypasses Payload access checks; private responses are no-store and Next image optimization is disabled.

Migration `20261118_153059_household_login` adds sessions, login quotas and household names/versions, backfilling existing names from contact names. On populated databases, back up and apply only outstanding reviewed migrations; never replay the initial migration.

Run `npm run test:household-login` for disposable-database migration, Program and login/privacy browser checks.

## Start here

1. **`domain/models.ts`** — describes a household and its members.
2. **`domain/validation.ts`** — checks submitted names, email and member lists.
3. **`domain/member-policy.ts`** — decides which members are added, renamed or removed. New members stay pending; name corrections keep existing approval.
4. **`application/UpdateHouseholdDetails.ts`** — coordinates one job: safely updating a household's editable details.
5. **`application/ports.ts`** — describes what storage and member-ID generation must provide. It does not connect to a database.
6. **`application/HouseholdRegistration.ts`** — validates an invitation, includes the contact, creates a pending household, and handles safe retries.
7. **`application/HouseholdCodeServices.ts`** — explicit admin code reveal and replacement.
8. **`infrastructure/`** — real Payload storage, credential encryption and durable rate limits.
9. **`composition-root.ts`** — connects the application classes to their dependencies. The original edit-details service still uses fakes in tests and is not exposed as a guest endpoint.

Administrator creation uses `application/CreateApprovedHousehold.ts`, sharing strict initial validation and credential provisioning with guest registration. Only the administrator use case creates approved households; guest registration stays pending. `GetHouseholdSummary.ts` provides pending-household counts, read in one database snapshot without requiring the credential secret.

The admin workspace lives in `components/admin/households/HouseholdWorkspace.tsx` and reuses `AdminList`/`AdminTable`. See [admin UI scope and verification](../../docs/household-admin-ui.md). The individual household editor retains native Payload persistence and fields with a matching card layout, explicit approval choices and separate code controls. See [editor refinement](../../docs/household-editor.md).

The reusable React fields live in `components/households/`. They display and edit form values, but do not log anybody in, save records or approve guests.

## Following an update

`UpdateHouseholdDetails.execute()` reads like a short checklist:

1. Validate the submitted details.
2. Load a household that the authenticated contact may edit.
3. Build the updated member list using the approval rules.
4. Save only if nobody else changed the household in the meantime.
5. Return the updated household.

The smaller private methods explain each step. They are not separate classes because they are all parts of the same job.

## Terms used in the code

- **Principal:** the household identity obtained from a verified login session. Never take this identity from a form field.
- **Revision:** a change counter. If someone else saves first, an old form must refresh rather than overwrite their changes.
- **Repository:** the interface for loading and saving households.
- **Reconciliation plan:** a list of proposed member additions, corrections and removals. It does not save anything.
- **Row key:** a temporary UI identifier that keeps a form row stable. It is not a permanent member ID and must be removed before submission to domain validation.
- **Fake:** a small test replacement for a real dependency, such as an in-memory repository instead of PostgreSQL.

## Keeping future code readable

- Use names that describe their contents: `currentHousehold`, `removedMemberIds`, `updatedDetails`.
- Give methods one clear job. Keep coordination in the use case, rules in pure functions, and database calls in the repository.
- Prefer straightforward control flow over clever one-liners.
- Explain important safety decisions in comments, not every obvious assignment.
- Do not add a class or abstraction unless it makes a real responsibility clearer.

For initial registration, the contact person automatically becomes the first member. The general edit validator must not add them again on every save.

Unit tests are in `tests/unit/household-*.test.ts(x)`. Run `npm run test:households` for the real registration/browser test: it builds the app, creates a disposable local database, applies/rolls back/reapplies migrations and runs against a separate production server. It does not overwrite the development database.

`npm run test:household-admin` additionally exercises the admin form (including a lost-response retry), native list interactions, tabs, invitation downloads and 320–1440px layouts, followed by the existing admin/editor/poll regressions in that same disposable database.
