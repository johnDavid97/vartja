# Public homepage

Design reference: `Forsiden_bryllup.pdf` supplied by the couple. Hero photo/colour, public updates carousel and footer; responsive navigation shared across wedding pages. Guest login and access locking remain a separate later task.

## Responsibilities

- `models.ts`: small presentation contract consumed by the hero/footer.
- `settings.ts`, `contrast.ts`: pure defaults, media/focal-point mapping and contrast; shared colour validation lives in `lib/colors.ts`.
- `carousel-navigation.ts`: pure page targeting, nearest-dot selection and actual scroll-boundary navigation.
- `lib/wedding-date.ts`: shared date formatting for hero/footer, independent of UI components.
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

## Review follow-ups — resolved

- [x] Carousel arrows use actual scroll boundaries and navigate from the current position; pure boundary tests and a real manual-scroll browser regression cover the original defect.
- [x] Shared subprocess helpers wait for exit and escalate to SIGKILL after a grace period before database cleanup; real-process tests cover graceful timeout, ignored SIGTERM, spawn failure and exit codes.
- [x] Shared date formatting extracted from `WeddingHero`, with invalid, date-only and summer/winter timezone tests.
- [x] `ColorField` uses configured descriptions/labels and shared colour validation, with reusable-field markup tests and native admin browser checks.
- [x] Removed the unused `NewsCards` homepage variant; the carousel continues to use `NewsCard` directly.

No real wedding content is replaced for screenshots. Test images/uploads are deleted during fixture cleanup. Desktop/tablet/mobile screenshots are reviewed separately from automated overflow assertions; these tests are not a substitute for checking on actual phones.
