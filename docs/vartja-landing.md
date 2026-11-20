# VårtJa landing page

## Scope

`app/(marketing)` owns `/` with its own root layout, Norwegian metadata and VJ favicon. It is a static public introduction to the wedding-website offering, not a wedding directory or a signup flow. It imports no Payload configuration, settings reader, authentication provider or custom client component. The home link uses Next Link with prefetch disabled. The production build prerenders `/`; serving it does not require a CMS/database read.

The design uses warm paper tones, green typography, shared locally served fonts and a CSS-drawn invitation/program illustration. The illustration is explicitly labelled and decorative, with no real couple, date, photographs or guest content. Navigation and the main action link to real sections on the page. Keyboard users have a skip link and visible focus indicators.

The copy covers existing capabilities: personalized names/colours, Program, posts, comments, polls and household access. There are no invented testimonials, prices, contact details, enquiry forms, payment flows or promises of self-service multi-wedding signup. Visitors invited to a wedding are directed to the link/QR supplied by their couple; the real wedding is not used as a marketing demo.

## Boundaries and compatibility

- The temporary `/` → `/andrea-og-martin` redirect is removed. Existing wedding homepage bookmarks should use the canonical wedding address.
- The wedding layout, settings, branding, authentication, APIs and native administration are unchanged.
- Legacy registration/QR and content aliases remain bound to Andrea & Martin. No invitation, session, credential, content or database change is needed.
- Marketing styles are scoped CSS Modules in a separate root layout. Cross-layout navigation is a full document navigation by Next.js design.
- Hosting, DNS and TLS for `vårtja.no` are not configured by this feature. Local preview is `http://localhost:3000/`.

## Verification

The routing unit test asserts that `/` is not redirected. The existing disposable wedding-routing suite checks HTTP 200 at the marketing root while preserving old links and registration/session behaviour. The landing browser check runs through the same isolated runner and checks metadata/icon separation, section links, keyboard access, responsive overflow and absence of wedding links/private data/API calls.

Run `npm run test:wedding-routing` to build and run the combined routing/landing browser checks. All mutation fixtures belong to the disposable routing database; landing checks themselves are read-only.

Verified: 336 unit tests across 47 files, production build (static `/`), TypeScript, and combined disposable routing/landing checks. Real approved-household and administrator sessions receive byte-identical public HTML without authentication-cookie changes. Browser checks cover invalid cookies, JavaScript-disabled navigation, keyboard skip/section/top links and 320/390/768/1440px layouts. Production screenshots were inspected. Lint retains only the four existing initial-migration warnings.

Independent source/screenshot review found no remaining concrete issues. Review corrections made the footer return to the actual header/page top and distinguished invalid-cookie coverage from authenticated-session coverage. An initial lint error for a plain home anchor was corrected to Next Link with prefetch disabled. No existing wedding data or permissions were changed.
