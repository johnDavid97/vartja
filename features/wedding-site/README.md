# Wedding routing and branding

One active wedding is served at `/andrea-og-martin`. This is a URL namespace, **not multi-wedding/tenant support**. Names, guests, posts, Program and administration still belong to the existing single installation.

## Routes and compatibility

- Explicit route folders under `app/(website)/andrea-og-martin` contain the wedding homepage, Program, posts, pictures, login and waiting page.
- `app/(access)/andrea-og-martin/register` retains the separate registration layout.
- `paths.ts` centralizes application-owned website links and compatibility redirects. Its base path must match the explicit route folders. Changing names in settings must not silently change this stable URL.
- `/admin`, `/api`, uploads/media and public assets stay at their existing root paths. Do not use a global Next `basePath` or prefix API endpoints.
- `/andrea-og-martin/admin` and its subpages temporarily redirect (307) to the existing `/admin` equivalents, preserving queries. This is an explicitly requested convenience alias only: the browser ends at `/admin`, with unchanged login/permissions, not wedding-specific administrator isolation. Other wedding slugs do not get this alias.
- Old `/news`, `/news/:id`, `/program`, `/bilder`, `/login`, `/waiting` and `/register` URLs permanently redirect to their canonical wedding equivalents. `/tidsplan` retains its existing meaning as an alias for the posts overview.
- Query strings pass through. Browser fragment inheritance preserves `#invitation=…` in old QR links without sending the key in a GET URL to the server.
- `/` redirects **temporarily** to the wedding homepage for this first step. A separate VårtJa landing page will replace that redirect later; internal wedding links already point directly to the wedding root.
- Unknown wedding slugs and removed pages (`/reiseplan`, `/ting-a-gjore`, `/wedding-party`) remain not found. There is no catch-all that shows this couple's data under arbitrary names.

## Invitations, sessions and deployment

- New invitation/QR URLs use the canonical registration path, with the existing fragment format and the same invitation key. No credentials or invitation secrets are rotated.
- `PUBLIC_SITE_URL` stays an **origin only**, e.g. `https://vårtja.no`, not an origin plus wedding path. WHATWG URL handling converts the internationalized hostname to its DNS-compatible form when serializing URLs.
- Existing household and administrator cookies, sessions, author identities, votes and API permissions are unchanged. Moving pages on the same origin does not require signing in again.
- Old QR codes still require their embedded hostname to reach this application (or a maintained redirect to it). Localhost/private-IP links cannot become publicly reachable through a pathname change. Hosting, DNS and TLS for the purchased domain are separate deployment steps.
- There are no schema changes, migrations or content rewrites. Authored rich-text links are not rewritten in stored content; old website paths remain supported through redirects.

## Configured wedding branding

- `branding.ts` is the shared pure presentation rule for names, monograms and tab titles. `Wedding.coupleNames` is the source of truth. The existing CMS field default remains the initial Andrea & Martin seed; no UI component uses those names as a fallback.
- Missing/empty names use the neutral “Bryllupet vårt” and a heart monogram. `&`, `og` and `+` separate partner names; Unicode initials are supported. Titles use literal full strings, not templates that could interpret `%s` inside a name.
- `branding-server.ts` reads only the public `coupleNames` field with native access and no relationship depth. React cache deduplicates within a request, not across visitors/edits. Failed reads get a neutral fallback and a generic warning without error data.
- Guest header, homepage name fallback, admin login logo and admin navigation use that identity. Admin navigation's server wrapper passes only the branding DTO to its existing client component; native providers, permissions and form state stay intact.
- Guest tabs use page-specific titles such as “Program · Andrea & Martin”. Article metadata deliberately uses “Innlegg”, never querying private/draft article titles. Admin tabs use safe section labels rather than document data. Registration keeps its no-referrer policy, and login/waiting/admin/registration keep noindex/nofollow.
- Saved names appear on fresh requests/reloads without restarting. Unsaved form edits are not public branding. This is not a realtime cross-tab subscription.
- Branding changes do not change the wedding slug, invitation keys/QR images, credentials, sessions, authors, votes or Program. There are no schema changes or data migrations.
- Wedding, registration and admin metadata use the configured monogram SVG at `/andrea-og-martin/brand-icon`. The endpoint reads only public initials, escapes SVG text, ignores query text and sends `no-store`; a monogram-based URL version also prevents stale icons after name changes. The old Next.js favicon was removed.
- `public/vartja-icon.svg` and the fallback `public/favicon.ico` carry the separate VJ platform mark. `vartjaIcons` is ready for the future landing page; the root still redirects to the wedding for now. These are tab icons, not additional home-screen/app icons.
- `npm run test:wedding-branding` exercises branding, saved/unsaved name changes, privacy, retained identity/content and long-name mobile layouts in a disposable database with fresh test secrets. Its icon checks verify exactly one icon on guest/admin/registration pages, SVG responses and updated URLs after saving names.
- Favicon follow-up verified with 336 units across 47 files, build/types, disposable branding browser tests, lint (only the four old warnings), independent source review and 16/32/64px visual inspection. Local wedding metadata also verified with exactly one configured icon.

### Branding verification and startup-order regression

Branding verification passed: 333 unit tests across 46 files, production build, TypeScript, dedicated disposable branding checks (independently rerun), homepage/login/Program and native household-admin/navigation/editor/poll regressions. Long names and keyboard navigation were checked at mobile and desktop sizes, including the open 320px admin sidebar. Independent source/security review found no remaining concrete issues. Lint retains only four initial-migration warnings.

The admin regression exposed an existing module-identity assumption: branding can initialize Payload from an RSC bundle before the REST bundle creates an approved household. The former module-local trusted-creation object then failed identity comparison. `collections/Households.ts` now shares an opaque frozen object through a process-wide registry. The capability itself is **not** a global symbol, which Flight can serialize. Native creation access remains denied, and the dedicated endpoint still requires an administrator. Module-reset/serialization unit checks and post-RSC HTTP household creation cover this regression.

Preservation checks hash complete households, posts and versions, comments and attribution, votes, sessions and Program, and compare administrator identity and invitation URLs. All writes use disposable databases and fresh secrets. A native browser check's background-network-idle wait was replaced with rendered-navigation readiness for streaming/prefetch; subsequent navigation, selection, editor and poll checks passed. A build timeout passed on rerun. No populated local database was changed.

## Future work

- Next step: the separate generic VårtJa landing page.
- Before adding a second wedding, introduce actual wedding ownership and isolation for content, households, credentials, sessions, invitations, media, activity and administrator permissions. A second slug alone is **not** sufficient, and this implementation must not be advertised as tenant isolation.
- Legacy aliases and printed invitation links must remain bound to the original couple, never reassigned to whichever wedding becomes a future default.
- The explicit single-wedding route boundary and central link helper provide a clear replacement point for a future validated wedding registry. They intentionally avoid introducing pretend multi-tenant routing now.

## Verification

Run `npm run test:wedding-routing` for the dedicated disposable routing checks.

Unit tests cover paths, redirect definitions, invitation origins/keys (including `vårtja.no`) and canonical link rendering. The disposable `wedding-routing-isolated.ts` suite covers actual browser redirect/fragment behavior, registration from old links, canonical navigation and authentication, session continuity and unknown paths. Existing homepage, household registration/login/admin, posts, Program, comments and poll regressions must continue to use unchanged root API endpoints.

Verified: 314 unit tests across 43 files, 14 browser smoke checks, build, TypeScript, and the dedicated routing suite (independently rerun). Disposable registration, login, homepage, posts-design, post-comments, Program activity, household-admin, native admin/editor and poll regressions passed. Mobile keyboard navigation/screenshot was checked. Independent source review found no concrete issues. Lint retains only four initial-migration warnings.

An early dedicated test run timed out during overlapping setup; its orphan disposable database was cleaned up. A registration fixture-name mismatch and a posts test calling a Node helper inside browser `evaluateAll` were corrected, then both suites passed. No production changes were needed for those test issues. Test invitation keys use disposable secrets, not the live installation's shared invitation key.
