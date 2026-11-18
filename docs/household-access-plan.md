# Household access: implementation plan

Branch: `feature/household-access`. Do not merge or push without permission.

## Agreed behaviour

- One shared invitation QR opens an unlisted registration URL containing an invitation key. This is possession-based access, not proof that somebody physically scanned a QR. Copied links work too.
- A household supplies a contact name, contact email and family members. Email is contact information only, not verified. No email delivery is required initially.
- Confirmed: initial registration automatically includes the contact person as the first family member, so their name is entered only once. Editing an existing household must not append the contact again.
- Registration issues a random household access code. The household must be approved by the couple before wedding content becomes accessible.
- Login uses the code, not a user-chosen password. Sessions are separate from Payload administrator authentication.
- Families manage their own contact details and members. Newly added members require approval; name corrections do not. Existing approved members and household access are unaffected by pending additions.
- The couple manages approval under **Brukere og admin**, with separate guest/household and administrator sections.
- Administrators can explicitly reveal/copy a stored code or generate a replacement. Replacement invalidates the old code and existing household sessions. Household revocation also invalidates sessions.
- Voting belongs to the household, using the existing poll system, not a new implementation.
- The front page stays public and contains household-code login. All other wedding pages require approved guest access; protect their underlying data, uploaded photos and image delivery too. Keyed registration and limited pending-household self-service are exceptions. Public front-page assets must remain accessible without exposing private content.

## Architecture rules

TypeScript strict. Framework-independent domain logic. One class per application responsibility. Constructor injection, wired in one server-side composition root. Interfaces for persistence, cryptography, time, sessions, throttling and auditing. Pure validation and approval rules outside adapters. Typed errors with safe public messages; never return credentials or internal exceptions accidentally. Tests use deterministic fakes.

Planned boundaries:

- `features/households/domain/`: types, pure validation/transition policies, typed errors; no Next/Payload/crypto imports.
- `features/households/application/`: use cases and ports; no concrete infrastructure construction.
- `features/households/infrastructure/`: Payload repositories, credential protection, session persistence, durable throttling and audit adapters.
- `features/households/composition-root.ts`: only production construction/wiring point.
- Thin route/action adapters: parse bounded input, enforce origin/CSRF policy, invoke use cases, set safe cookies and return narrow DTOs.
- `components/households/`: reusable presentation components. Reuse existing Button/Card and admin button/table patterns. Styling/layout replaceable without changing authentication or business rules.

Avoid creating classes around trivial pure functions or React components. Do not refactor unrelated existing features merely to impose OOP.

## User stories and tasks

### HA-01 — Household domain and rules
**As a household contact**, I can provide valid household details and manage members without approving myself or somebody else.
- [x] Domain types, validation, stable member IDs and approval-preserving edits.
- [x] Pending additions do not revoke an already approved household.
- [x] Revoked-household editing denial and stale-edit/CAS contract with tests using fakes.
- [ ] Production atomicity and replacement-code/session invalidation.
- [x] Unit tests with fakes; no database writes during unit tests.

### HA-02 — Invitation registration
**As an invited family**, I can scan the common QR, register and save my household code.
- [x] Couple can obtain the shared invitation link/QR from admin; no external QR service sees the key.
- [x] Invalid or absent invitation key cannot submit registration.
- [x] Registration form includes the contact as the first member exactly once, without duplicating them on retries.
- [x] Server validates all fields, rejects supplied approval flags and enforces size limits.
- [x] Code shown intentionally after successful creation, with copy/save guidance; no household credentials in URLs, logs or browser storage.
- [x] Request-key retries are race-safe and reject changed content; durable invitation-holder quota. Unverified email does not merge households.

### HA-03 — Login, pending status and logout
**As a registered family**, I can log in using my access code and see whether we are approved.
- [x] High-entropy generated code; encrypted recovery copy plus independent lookup hash; no plaintext database storage.
- [x] Expiring server-validated sessions, HttpOnly/SameSite cookies, Secure in production.
- [x] Durable login throttling, generic invalid-login errors and safe origin checks.
- [x] Pending families can see only their own minimal account/status information, not wedding content.
- [x] Logout, expiry, code replacement and revocation checked server-side.

### HA-04 — Couple's administration
**As the couple**, we approve households and additional members without granting admin privileges.
- [x] Guest/household and administrator sections beneath Brukere og admin.
- [ ] Pending counts/filter and explicit approval/revocation controls.
- [x] Create households via the invitation form (also usable by the couple), approve/edit via native admin fields; native uncredentialed creation disabled.
- [x] Explicit authenticated reveal/copy and confirmed code replacement; code fields never included in ordinary lists/API responses.
- [x] Audit code reveal/replacement without credentials; replacement and audit are transactional.
- [x] Session invalidation on approval withdrawal/revocation.
- [ ] Dedicated approval/revocation audit (credential reveal/replacement auditing is implemented).

### HA-05 — Household self-service
**As a family**, we can edit our own details and add/remove members.
- [ ] Household identity derived from the session, never trusted from request input.
- [ ] Stable IDs; no tampering with another household or approval status.
- [ ] New members pending, corrections retain approval, removed members handled without corrupting records.
- [x] Reusable controlled contact/member fields, shared UI primitives and static accessibility tests.
- [ ] Wire complete forms with loading, validation and confirmation states; verify browser interactions/mobile layout.

### HA-06 — Private site and household voting
**As the couple**, only approved guests and administrators can access wedding content.
- [ ] Authorize at data/page boundaries, not only the shared layout or navigation.
- [ ] Protect Payload REST/GraphQL reads and upload file delivery; test image optimization/cache bypasses.
- [ ] Avoid private content in static HTML, shared caches, metadata or unauthenticated RSC responses.
- [ ] Existing polls use stable household identity, including across devices/code replacement; retain concurrency protection.
- [ ] Review historical anonymous ballots explicitly; do not silently delete data.

### HA-07 — Persistence and release verification
**As the maintainers**, we can deploy or roll back safely without changing old migrations or losing existing data.
- [x] New registration migration only; prior migration SQL/snapshots unchanged.
- [x] Generate types/import map, review migration, test fresh-chain and registration rollback/reapply in disposable databases.
- [ ] API integration and browser tests for registration through approval, cross-household denial, recovery, revocation and privacy.
- [ ] Typecheck, lint, unit tests, production build and existing feature regressions.
- [ ] Documentation for secrets, backup/recovery, invitation printing and deployment. No production secrets or personal guest records in test fixtures.

## Agent work and review gates

The main assistant is architect, integration owner and reviewer. Delegate bounded file ownership, not overlapping edits. Agents must not migrate the development database, change secrets, commit, merge, push or launch nested agents. Review contracts before adapters, inspect every diff, then run independent verification. Read-only security/UI reviews can run concurrently. Do not claim implementation or tests completed based only on an agent's summary.

## Decisions still needing clarification

- RSVP: attendance for the wedding overall or separately for each day/event? Do not invent a data model for this; keep RSVP out of the initial access implementation until clarified.
- Historical anonymous poll ballots cannot reliably be attributed to households. Preserve them until the couple chooses whether to reset poll results before guest launch.
- Proposed safety defaults (configurable): 30-day sessions; a bounded member count and input lengths; separate long-lived shared invitation key from household codes. Printed QR needs the final public domain before printing.

## Current status

First work package implemented: pure domain, constructor-injected update-details use case, composition root with fake adapters, and reusable controlled field components. Domain and presentation implementation agents completed their bounded work; independent security and code reviews completed. Architect reviewed source and fixed error classification, sparse input handling, controlled row identity and UI/domain limit consistency. See `household-access-architecture.md` for security findings and release gates.

Registration slice is now implemented: `/register` with invitation fragment; persisted pending households; shared link/QR under `/admin/collections/households`; native approval/member editing; encrypted code receipt, admin reveal and transactional rotation/auditing. A real production-server Playwright test covers registration, initial member approval, new pending members, protected-field tampering, retries/races, code replacement, audit rollback, global throttling and mobile layout. Fresh migrations/rollback/reapply are tested in a disposable database. Local admin link/form were also verified without submitting a real household.

Local development already had the additive registration tables; columns were checked against the new migration without resetting data. Automatic future schema pushing is disabled. Existing dev-synced databases need a deliberate migration baseline, not replay of old migrations.

Guest login/sessions and private website/API/media enforcement are now connected; see `features/households/README.md`. Login ignores name casing and whitespace; duplicate names are distinguished by codes. Remembered sessions last 12 months per device and survive name changes, but not code replacement or loss of approval. Anonymous visitors see only public homepage content and login; pending households see their status. Household self-service, RSVP and household poll identity remain unconnected. The original edit-details use case remains a tested foundation, not a guest-facing endpoint.
