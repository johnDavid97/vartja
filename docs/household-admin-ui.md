# Household admin UI

## Agreed scope

- One **Husstander** sidebar entry under **Brukere og admin**, with **Oversikt** and **Felles invitasjon** tabs. **Administratorer** remains a separate link.
- Reuse the shared `AdminList` / `AdminTable` and native Payload search, filtering, sorting, selection and pagination. Contact name/email, member initials/count, status, last changed.
- Sidebar badge counts pending households only, not pending members of approved households.
- **Ny husstand** opens a matching form built from existing form/button components. The couple's manually created household and initial family members start approved.
- Existing rows still open the current editor; editor redesign and guest login/privacy are separate tasks.
- Display statuses: **Venter / Godkjent / Avslått**. The persisted `revoked` value remains unchanged; no records are converted or removed.
- Invitation tab follows the supplied PDF: masked link with reveal/copy/open controls, locally generated PNG/SVG QR downloads, honest localhost warning. Masking is visual discretion only: a visible QR also contains the full invitation URL.

## Safety and architecture

- Administrator creation is a dedicated authenticated, same-origin POST, not unrestricted native collection creation.
- Server creates credentials, member IDs and approval state atomically. The browser cannot choose security fields or approval flags.
- Reuse registration normalization/provisioning where appropriate; guest registration remains pending and retains its existing replay guards.
- Admin idempotency keys are namespaced by operation and authenticated administrator, with content fingerprints. Retry returns the original record ID without rotating/revealing its credential or changing later approval decisions.
- Summary counts are authenticated and private/no-store, calculated together in one SQL snapshot. No secret is needed merely to count registrations.
- Overview links explicitly include `tab=overview`: Payload merges list query state, so omitting the tab can otherwise restore the previous form/invitation tab during client navigation.
- Interfaces around persistence, focused application services, constructor injection and composition-root wiring. UI modules depend on API contracts rather than database adapters.
- No schema changes anticipated. Preserve existing household/Program/site content and native editor behavior.

## Verification

New disposable-database browser/API suite covers approved manual creation, automatic contact inclusion, native list/cells/search/selection, counts, invitation controls/downloads, mobile layouts and request isolation/security. Existing guest registration and credential tests remain regression gates. Unit tests use fakes for application behavior and pure helpers for presentation rules; markup tests do not substitute for browser interaction.

Verified on `feature/household-admin-ui`: production build, 206 unit tests, TypeScript, isolated registration, admin and homepage suites, native admin/editor/poll regressions, and 12 public e2e checks. Browser layouts checked at 320, 390, 768, 1024 and 1440px, with screenshot review. Independent review's count-snapshot finding was fixed; native sorting/pagination and lost-response retries now have browser coverage. A household relationship drawer is not currently exposed in the app; its adapter preserves native drawer behavior, but that specific path has not been exercised in a real browser.

An initial regression attempt against the long-running development server hit a Payload `useConfig` SSR/context error and Next's development overlay. The same admin/editor/poll suites pass against a fresh production server. A subsequent complete admin-design run also passed on the development server without restarting it; the initial error did not reproduce.

No schema migration or real data replacement was needed.

## Remaining review follow-ups

- **Ambiguous-response editing:** an unchanged retry reuses its request key and is covered by a browser test. However, editing any field after a lost response clears the key, even for whitespace-only changes. If the first request was saved, submitting again can create a duplicate household. Preserve the original submitted snapshot/key until the uncertain result is resolved, and add coverage for edits after a lost response.
- **Duplicate summary polling:** the sidebar and overview each instantiate `useHouseholdSummary`, creating independent requests and timers. Sharing the summary state would avoid redundant fetching and temporarily differing counts.
