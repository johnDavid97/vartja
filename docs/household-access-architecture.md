# Household access architecture and security decisions

Status: registration persistence, admin approval, invitation QR and encrypted code recovery/replacement implemented. Guest authentication, sessions, privacy enforcement and self-service remain unwired.

## Dependency direction

```
HTTP / Payload UI / React forms
            |
    application use cases <--- repository / crypto / session / clock ports
            |                                  ^
       pure domain                    infrastructure adapters

composition-root.ts constructs the use cases and supplies their dependencies.
```

`UpdateHouseholdDetails` is the first application use case. It accepts a principal supplied by a future verified session adapter, an expected revision, and unknown form input. It must never receive its principal from submitted JSON. Persistence is behind `HouseholdRepository`; IDs behind `MemberIdGenerator`. Unit tests instantiate the composition root with fakes.

An application's construction root is not an authentication guard. No public route may call this service until authentication, request validation and the production repository are connected and verified.

## Household editing

- Confirmed registration behaviour: include the contact person as the first member automatically, with their name entered only once. This belongs in initial registration assembly, not the generic edit validator. Contact fields remain separate from the member list so subsequent edits/retries do not silently create another member. The registration service now implements this behaviour.
- New members are pending; existing names can be corrected without altering approval.
- Member IDs are generated server-side. Guest-supplied existing IDs must already belong to the authenticated household.
- The current whole-form edit is safe only when the adapter implements atomic compare-and-swap. **Every** write path, including admin approval and deletion, must participate in revision updates.
- On a revision mismatch the caller must refresh, not silently merge or retry with a newer revision. The fake contract tests do not prove PostgreSQL atomicity; integration tests must.
- Revoked households cannot edit; pending households may correct their own details without seeing wedding content.
- Registration is not an RSVP. Attendance scope still needs a product decision.

## Sessions and recoverable codes (codes implemented; sessions planned)

Prefer opaque cryptographically random session tokens with only a digest stored server-side. This avoids inventing a JWT/encrypted-cookie protocol and supports device logout, expiry and revocation. Native Node crypto supplies randomness and authenticated encryption; do not implement primitives. Evaluate any session-library integration against separate admin/guest cookies before adoption.

Household codes need high entropy and a readable, normalized format. They are shared credentials, not verified personal identity. Store a keyed lookup digest and an authenticated encrypted recovery copy in a server-only credential store; use a dedicated secret, versioned encryption and household identity as associated data. Ordinary Payload APIs, lists and DTOs must not expose any credential fields.

Code reveal and replacement are explicit administrator-only POST operations, with same-origin JSON controls, replacement confirmation and credential-free auditing. Replacement uses atomic SQL version comparison and commits its audit in the same transaction. Registration retries cannot reveal a replaced code or recover a processed household. When sessions are implemented, replacement and revocation must invalidate them atomically. Verify current household/session state at each protected request; never authorize solely from stale client state or a long-lived cookie claim.

Email is unverified contact data. It must not authorize recovery, auto-merge households or disclose an existing household's code. Registration response-loss/retry behaviour needs explicit idempotency or a safe route to couple-assisted recovery, not recovery based only on knowing an email address.

## Site privacy release blockers

The existing website is still public until the full access feature is integrated. Do not advertise privacy before all entry points are covered.

- `Posts`, `Wedding`, `Media`, program reads and poll endpoints currently allow public content access in different ways. Authorize all of them.
- Existing `Boolean(req.user)` checks assume every Payload-authenticated user is an administrator. Preserve structural separation and use explicit administrator checks before adding any guest authentication strategy.
- A shared layout check is insufficient: static page content, metadata, RSC/prefetch responses and privileged local API reads each need review. Authenticated content must not enter public static shells or shared caches.
- Uploads are outside `public/`, but Payload file-serving authorization must be verified for originals, variants, HEAD and range requests.
- Private images must not leak through Next's publicly cached optimizer. Use authenticated direct image delivery and unoptimized rendering initially, with private/no-store responses.
- Request authorization must survive logout, code replacement, revocation, direct URLs and two-device scenarios. Already downloaded data cannot be remotely erased from a guest's device.

## Abuse protection and transport

Use durable, atomic throttling backed by PostgreSQL; in-memory rate limits are insufficient across instances and restarts. Define trusted proxy/IP handling explicitly. Bound all request bodies and inputs. Require same-origin mutations and apply a consistent CSRF policy, including login and logout. Credentials must not appear in URLs, logs, analytics or browser local storage.

A shared invitation key can be copied. Approval remains the actual guest authorization boundary. A fragment-based registration invitation avoids sending that key in URL/referrer logs, while a bounded registration request can verify it server-side. Generate the QR locally, without a third-party QR API. Printed invitations require the final public hostname.

## Existing polls

Keep the existing poll definitions and concurrent-vote protection. New ballots use a stable household ID, not a device cookie or access code. Replacing a code must not create a fresh voter identity. Historical anonymous ballots cannot be attributed reliably to households: preserve them and seek an explicit reset decision before launch. A new nullable relationship/unique constraint can distinguish legacy from household ballots without destructive conversion.

## Verification gates

1. Pure rules + application tests with fakes, including approval preservation and stale edits.
2. Production adapter integration tests for atomicity, private credentials, throttle behaviour, and session revocation.
3. Disposable database migration tests: fresh chain, upgrade, rollback and reapply. Existing migration files remain unchanged.
4. Browser interaction, accessibility and mobile tests for actual wired forms. Server-rendered markup tests alone are not sufficient.
5. Production privacy matrix: anonymous, pending, approved, revoked and administrator; test HTML, API, RSC, media and polls.
6. Existing admin/editor/poll regressions, strict TypeScript, lint and production build.
