# Public homepage

Design reference: `Forsiden_bryllup.pdf` supplied by the couple. Hero photo/colour, public updates carousel and footer; responsive navigation shared across wedding pages. Guest login and access locking remain a separate later task.

## Responsibilities

- `models.ts`: small presentation contract consumed by the hero/footer.
- `settings.ts`, `contrast.ts`: pure defaults, media/focal-point mapping, colour validation and contrast.
- `application/LoadHomepage.ts`: public homepage reads through an injected `HomepageRepository` interface.
- `infrastructure/PayloadHomepageRepository.ts`: Payload queries; explicitly published/public posts only.
- `composition-root.ts`: production wiring and request-local React cache, not cross-request caching of CMS changes.
- `components/homepage/`: hero/footer, server-rendered updates and a small interactive carousel.
- `components/NewsCard.tsx`: shared card for both homepage and existing news grid.
- `components/WeddingCountdown.tsx` / `lib/wedding-countdown.ts`: ticking view and pure timestamp calculation.
- `components/admin/fields/ColorField.tsx`: reusable native colour input plus validated hex field, using Payload form state.

Existing names/date/place/welcome are reused, never replaced with PDF example content. Hero eyebrow/suffix and background controls live in the existing Wedding global. Background image uses the existing media relationship and native focal-point metadata. Selecting a colour does not delete the previously chosen photo. Admin-only updates; these global fields and the chosen front-page image are public.

The homepage uses normal document scrolling, no full-screen nested scroll/snap containers. Only the updates row scrolls horizontally. Carousel targets are measured after hydration and resize; controls reflect 1/2/3 fully visible cards per page. No autoplay; reduced motion, keyboard navigation, accessible control names and a skip link are supported. Text colour is selected for contrast on solid backgrounds; photos have a dark overlay.

## Persistence and checks

Only additive migration `20261117_211959_homepage_appearance` is new. Previous migrations and existing wedding/Program/household data are preserved. Locally, only this migration was applied transactionally after a private DB backup; the older dev-sync migration history still needs a deliberate baseline before generic migration replay.

- `npm test`: pure logic, fake-backed reader and server markup checks.
- `npm run test:homepage`: production build, fresh disposable PostgreSQL database, rollback/reapply with legacy field preservation, real admin and responsive browser checks.
- Existing news/admin and household integration suites remain regression gates.

## Review follow-ups

- Base carousel arrow availability on actual scroll boundaries, not the nearest page; add a manual-scroll regression test.
- Wait for timed-out test subprocesses to exit, with forced termination if needed, before database cleanup.
- Extract shared date formatting from `WeddingHero` into a pure helper with timezone/date-only tests.
- Reuse configured field descriptions and shared colour validation in `ColorField`.
- Remove the unused homepage variant from `NewsCards` (the carousel uses `NewsCard` directly).

No real wedding content is replaced for screenshots. Test images/uploads are deleted during fixture cleanup. Desktop/tablet/mobile screenshots are reviewed separately from automated overflow assertions; these tests are not a substitute for checking on actual phones.
