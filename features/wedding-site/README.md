# Wedding URL namespace

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

## Future work

- Next steps: configured wedding logo/tab branding, then the separate generic VårtJa landing page.
- Before adding a second wedding, introduce actual wedding ownership and isolation for content, households, credentials, sessions, invitations, media, activity and administrator permissions. A second slug alone is **not** sufficient, and this implementation must not be advertised as tenant isolation.
- Legacy aliases and printed invitation links must remain bound to the original couple, never reassigned to whichever wedding becomes a future default.
- The explicit single-wedding route boundary and central link helper provide a clear replacement point for a future validated wedding registry. They intentionally avoid introducing pretend multi-tenant routing now.

## Verification

Run `npm run test:wedding-routing` for the dedicated disposable routing checks.

Unit tests cover paths, redirect definitions, invitation origins/keys (including `vårtja.no`) and canonical link rendering. The disposable `wedding-routing-isolated.ts` suite covers actual browser redirect/fragment behavior, registration from old links, canonical navigation and authentication, session continuity and unknown paths. Existing homepage, household registration/login/admin, posts, Program, comments and poll regressions must continue to use unchanged root API endpoints.

Verified: 314 unit tests across 43 files, 14 browser smoke checks, build, TypeScript, and the dedicated routing suite (independently rerun). Disposable registration, login, homepage, posts-design, post-comments, Program activity, household-admin, native admin/editor and poll regressions passed. Mobile keyboard navigation/screenshot was checked. Independent source review found no concrete issues. Lint retains only four initial-migration warnings.

An early dedicated test run timed out during overlapping setup; its orphan disposable database was cleaned up. A registration fixture-name mismatch and a posts test calling a Node helper inside browser `evaluateAll` were corrected, then both suites passed. No production changes were needed for those test issues. Test invitation keys use disposable secrets, not the live installation's shared invitation key.
