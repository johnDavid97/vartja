# Andrea & Martin — wedding website

Next.js website with a self-hosted Payload CMS and PostgreSQL.

## Local development

1. Install dependencies: `npm ci`.
2. Create `.env` using `.env.example` if it does not already exist.
   Generate separate random values for the database password, Payload secret and `HOUSEHOLD_ACCESS_SECRET`
   with `openssl rand -hex 32`. Use the same database password in `DATABASE_URL`.
   Never commit `.env`.
3. Start Docker Desktop, then run:

   ```bash
   npm run db:up
   # New/empty databases only; tracked deployments also use the migration command.
   npm run payload -- migrate
   npm run dev
   ```

4. Open **http://localhost:3000/admin** and create the first account.
   Do this locally before exposing the app to the internet.
5. Use the admin sidebar to edit **Bryllupsinformasjon** or create an **Innlegg**.
6. Open **http://localhost:3000/andrea-og-martin** for the wedding site. `/` temporarily redirects there until the separate VårtJa landing page is added. Admin and APIs remain at `/admin` and `/api`; see [routing and old-link compatibility](features/wedding-site/README.md).

Automatic development schema pushing is disabled. Existing databases previously created
with dev schema sync (a `dev` migration record) must be baselined before using the migration
command; do not replay the initial migration or reset a populated database. The existing local
registration tables were checked without resetting data. New migrations are verified against
a disposable database by `npm run test:households`.

The first account is created through Payload's first-user setup. After that,
only signed-in editors can create accounts. All accounts are trusted editors
with the same permissions; do not create guest accounts here.

## Household registration (first usable slice)

Open `/admin/collections/households` through **Brukere og admin**. Select **Vis invitasjonslenke**,
then **Åpne registreringsskjema**. The same link/QR can be given to every household; use the final
public domain before printing. Set `PUBLIC_SITE_URL=https://your-domain.example` in the hosted
server's environment (restart the server after changing it). This overrides the request hostname,
so previews/proxies cannot accidentally put their address into the QR. When unset, the current
request origin is used. Public addresses must use HTTPS; HTTP is accepted for localhost only.
The QR stores the complete URL: an already downloaded/printed localhost QR will not change when
the site is deployed. Generate and download a new QR after setting the final domain.
The invitation key is in a URL fragment rather than a query string.
New links use `/andrea-og-martin/register#invitation=…`. Old `/register#invitation=…` links redirect without changing the key. Opening registration without the complete link shows instructions instead of a registration form. Keep `PUBLIC_SITE_URL` as the origin only (e.g. `https://vårtja.no`), without the wedding path.

Registration stores a pending household, automatically includes its contact as the first member,
and shows a generated access code. Email is unverified contact information; no email is sent.
The couple can set **Status → Godkjent** and save, approving the initial members. Later additions
can be reviewed separately. **Administratorer** opens the separate admin-user collection.
Native household creation is disabled; the couple can use the same registration form on behalf
of a family and then approve it.

Household details are admin-only. Code ciphertext/digests are excluded from normal API responses;
explicit admin code reveal/replacement is audited. Replacement and its audit write use one database
transaction. Retries use an idempotency key; it cannot recover a replaced code or a processed
household. A lost code can be obtained from the couple. Unverified email never authorizes recovery.
The invitation-holder quota is a durable global 100 attempts/minute, not an IP-based limit.

Back up `HOUSEHOLD_ACCESS_SECRET` securely along with the database. Changing it invalidates
invitation links and makes existing encrypted codes unrecoverable; rotation requires a deliberate
migration, not simply changing the environment variable. Never commit this secret.

**Not yet implemented:** guest code login, sessions, private wedding pages/media, household self-service,
RSVP and household-based voting. Approval currently records the couple's decision; it does not yet
provide guest login. Existing wedding pages/uploads remain public. Do not launch this as a private
invitation website until those remaining access controls are complete.

## Editing the website

The admin uses a Norwegian, light green-and-white design with a responsive sidebar.
Poll overview and comment overview entries remain disabled **Kommer** placeholders;
existing post poll blocks still work. **Program** is now an active multi-day itinerary editor. Preview is likewise marked as not yet available.
Publishing remains immediate: the date picker changes the displayed date, not scheduling.
It uses Europe/Oslo time, supports quick dates, cancellation and **Sett automatisk**.
Automatic dates are assigned when publishing. The description counter recommends 160
characters but does not truncate or reject older, longer descriptions.

- **Innstillinger → Bryllupsinformasjon**: names, date, place and welcome text are connected to the homepage. Under **Utseende på forsiden**, edit the two hero headings and choose **Bilde / Farge**. Select/upload an image using the existing media library, or choose a background colour. The chosen photo is retained when switching to colour. Missing photos fall back to the selected colour; text contrast adjusts automatically. Payload's existing image-editor focal point controls the responsive crop.
  Legacy travel information is retained but is not displayed publicly. Program is the only timetable source. The obsolete schedule and its stored entries were explicitly approved for permanent removal; the removal migration leaves Program content and history unchanged.
- **Program** (`/admin/globals/program`): create dated days and flight, train, bus, hotel,
  event or information items. Select a row to edit details; drag handles or arrow buttons reorder
  items. Dates are calendar dates and times are local `HH:mm` values (no browser timezone conversion).
  Earlier return/end times mean the following day. Untimed hotel/information items are supported.
  Edits, including deletions, enter the main form immediately; **Ferdig** only closes the detail panel.
  Use **Lagre utkast** or **Publiser** to persist them. Existing published content remains visible
  while a new draft is edited. `/andrea-og-martin/program` shows only the published itinerary, ordered by date/time;
  equal times preserve manual order, and untimed items come last. An empty published program shows
  “Programmet kommer snart.” Version history is not exposed to editors (no Versions tab or history API);
  internal version storage remains only to support native draft/live separation. Anonymous API access is denied. Preview, comments and polls
  inside Program are intentionally deferred; shared comments/polls come on a separate branch.
- **Innlegg**: enter a title, short description and optional cover photo for the cards.
  Write the article in the single **Artikkel** visual editor. Select text and use the fixed
  toolbar for bold, italic, lists, alignment, headings and **Liten / Normal / Stor** text sizes.
  There are no blue insert lines, `/` insertion menu or toolbar Add button. Text and headings
  stay in the editor/toolbar. Add photos, polls and **Skillelinje** (horizontal rules) from
  the sidebar by dragging them into the article, or tapping them on mobile.
  Under **Byggeklosser**, drag **Bilde** into the article to add a coloured placeholder.
  Click the placeholder to open your computer's file picker directly (no media-library drawer).
  After uploading, use the settings icon on the photo to edit its accessible description and optional caption.
  On mobile/keyboard, place the cursor in the editor and click **Bilde** instead of dragging.
  Drag the handle on the left of existing content to reorder it.
  Drag **Avstemning** into the editor to add a poll: enter a question, 2–10 different answers,
  and publish. Guests can choose one answer and see the results. Turn off **Åpen for stemmer**
  and publish to close voting while keeping results visible. After the first vote, question
  and answer edits are blocked; make a new poll instead. Reordering answers/the poll is fine.
  **Publisering** contains visibility, theme and publication date; comments/likes remain
  clearly marked as planned, without nonfunctional on/off switches.
  Existing descriptions, cover photos and old blocks are adapted into the visual editor
  when opened, without changing their stored data until saved. Old block fields are retained
  for compatibility but hidden in the editor. Once saved, the visual document is authoritative;
  deliberately clearing it does not bring old content back.
  New drafts are not public. **Publiser endringer** shows public posts under **Nytt fra oss** and `/andrea-og-martin/news`.
  Saving a draft of an already-published post leaves its last published version visible.
  Set **Synlighet → Privat** and publish that change to hide it from public pages and API reads.
  Private posts remain accessible to signed-in editors in Payload (not a guest invitation system).
  This does not protect media URLs: uploaded images remain public. Never upload confidential files.
  The homepage shows the 12 most recently created published public posts.
- **Bilder**: upload JPEG, PNG or WebP images up to 10 MB. Add a short image description.
  All uploaded files are public, even when attached to a draft. Do not upload sensitive files.
- **Brukere og admin**: household registrations and approvals, with a separate **Administratorer** section for trusted editors.
- Cover images support native file selection, drag/drop and selection from the media library.
  Removing a cover image does not delete the media file. Edit image descriptions in **Bilder**.

Visitors see saved/published changes when they open or refresh the homepage.
This is not live push updating of an already-open browser tab.
Comments, likes, RSVP, invitation sending, and password-reset email are not configured.

Polls use a signed HttpOnly browser cookie (one-year lifetime) and a unique database key to
prevent repeated/concurrent votes from the same browser. Clearing cookies, using another browser
or automating new browser identities bypasses this limit: this is not one-vote-per-person security.
No guest names or IP addresses are stored with votes. Only aggregate counts and the current
browser's choice are returned; raw ballots are not accessible through public CRUD endpoints.
Draft/private/missing/closed polls reject voting. Results refresh on page load or after voting.
Add reverse-proxy request rate limiting before exposing polls widely; invitations/authentication
would be needed for stronger voter identity. Keep PAYLOAD_SECRET stable to preserve cookie validity.
Comments and likes will be separate bottom-of-article features, not reorderable content blocks.

## Files

- `app/(website)/` — existing website pages, layout and styles. URLs are unchanged.
- `app/(payload)/` — isolated admin layout and Payload REST API.
- `payload.config.ts` — CMS configuration and database connection.
- `collections/Users.ts` — editor accounts and access rules.
- `globals/Wedding.ts` — editable wedding details and homepage appearance.
- `globals/Program.ts`, `lib/program.ts` — versioned program, stable day/item IDs, server validation and public sorting.
- `components/admin/program/` — multi-day visual editor using shared admin buttons and native Payload draft/publish controls.
- `app/(website)/andrea-og-martin/program/page.tsx` — live-only public itinerary; no draft query parameters are accepted.
- `migrations/20261108_220804_wedding_program.ts` — Program and Program version tables; run migrations before production deployment.
- `collections/Posts.ts` — draft/published guest updates.
- `blocks/postBlocks.ts` — legacy text/photo block schemas.
- `blocks/ArticlePhoto.ts` — visual photo placeholder schema.
- `blocks/ArticlePoll.ts` — poll question, choices and open/closed setting.
- `collections/PollVotes.ts` — private ballots and unique vote keys.
- `lib/poll-endpoints.ts` — validated voting and aggregate-result endpoints.
- `components/Poll.tsx` — guest voting and results.
- `components/PostContent.tsx` — rich-text rendering with legacy fallback.
- `components/PostRichText.tsx` — public headings, formatting, font sizes and photos.
- `components/admin/editor/` — sidebar, drag/drop bridge, direct file upload and editor styling. The poll card uses compact, accessible question/answer fields and shared admin buttons; Payload row operations preserve answer IDs and enforce 2–10 choices. Open/closed voting and voting limitations remain under “Avstemningsinnstillinger”.
- `lib/legacy-post-editor.ts` — non-destructive conversion of old posts on read.
- `lib/editor-text-sizes.ts` — shared editor/website size presets.
- `lib/post-content.ts` — legacy fallback and paragraph handling.
- `collections/Media.ts` — public photo uploads.
- `components/admin/` — navigation, dashboard, status header and branding.
- `components/admin/fields/` — publication field, visibility cards, cover upload and description.
- `components/admin/AdminDatePicker.tsx` — shared calendar/popover for publication dates (Oslo datetime) and Program days (date-only). Both support cancel/Escape and mobile positioning.
- `components/admin/tables/` — shared list/table adapter for posts, media, users and their selection drawers. Payload retains permissions, queries, sorting, column preferences, bulk actions and pagination. Mobile tables scroll within their frame; rows retain real keyboard-accessible links/buttons.
- Post lists show descriptions, themes, actual draft/private/published states and Oslo publication dates. Search matches titles and themes; counts reflect the current query. Existing saved column preferences are respected.
- `lib/publication-date.ts` — timezone-safe publication date conversion.
- `app/(payload)/custom.css` — admin-only styling.
- `compose.yaml` — local PostgreSQL, bound to localhost port 5433.

## Useful commands

```bash
npm run db:up                 # Start PostgreSQL
npm run db:down               # Stop PostgreSQL without deleting its data
npm run generate:types       # After changing the CMS schema
npm run generate:importmap   # After adding custom admin components
npm run lint
npx tsc --noEmit
npm test                     # Unit tests: block order, legacy fallback, image handling
npx playwright install chromium  # First-time browser setup
npm run test:e2e              # Read-only desktop/mobile checks; requires npm run dev
npm run test:editor           # Local editor/publishing integration check; see below
npm run test:polls            # Local poll editor/voting/privacy integration check
npm run test:admin            # Local admin design, date picker and upload integration check
npm run test:program          # Requires an empty local Program with no version history
npm run test:homepage         # Builds and tests homepage/admin in a disposable database
```

Browser tests use `http://localhost:3000` by default (override with `TEST_BASE_URL`).
The published-article test skips if the database has no published posts. Browser smoke tests
never edit existing content; block rendering/order is additionally covered by unit tests.
`test:editor` requires `.env`, a localhost database, and the development server on port 3000.
It creates temporary editor/post/photo fixtures; tests native sidebar drag/drop, the direct
file picker/upload, formatting, publishing, private-post access and mobile layout; and removes
its fixtures afterward.
`test:polls` likewise creates/removes local fixtures and checks actual browser voting,
concurrent duplicates, immutable answers, private/closed polls and responsive results.
`test:admin` checks all admin sections, cover upload, visibility, date persistence/cancellation,
Norwegian dates in a different browser timezone, automatic publication dates and mobile navigation.
It also checks shared tables, live counts, theme search, status badges, sorting, pagination,
row selection/navigation, media-library selection and mobile table overflow.
It saves review screenshots to `/tmp/sammen-admin-*.png` and removes its fixture records.
`test:program` refuses to run if Program has content or version history. It exercises days, item
editing, drag/keyboard ordering, draft isolation, publication, API permissions, deletion and mobile
layouts. It restores the initial empty Program and removes its fixture versions/user afterward.
Screenshots are saved to `/tmp/sammen-program-*.png`.
Do not run these fixture tests against production.

`test:homepage` checks native admin colour saving and media-library selection, image/colour switching,
focal position, missing-image fallback, private/draft exclusion, carousel arrows/dots/keyboard,
mobile navigation and resizing from 320 to 1440px. It tests fresh migrations and feature rollback/reapply
while preserving pre-existing wedding fields. Screenshots are saved to `/tmp/sammen-homepage-*.png`.
The shared isolated-database runner also powers the household registration tests. No existing local
wedding content is replaced by these tests.

Database data persists in the `sammen_postgres_data` Docker volume.
**Do not run `docker compose down -v` unless you intend to delete the database.**

## Deploy to Railway (Docker)

The Docker image serves both the Next.js site and the Payload admin/API. Use a
**separate Railway PostgreSQL service**; the local `compose.yaml` is not used on
Railway. An initial migration in `migrations/` sets up a **fresh** production DB.
Local development data and uploaded photos are not transferred automatically.

1. Push the project (including `Dockerfile`, `docker-entrypoint.sh` and
   `migrations/`) to a repo, preferably private. Do not commit `.env` or `media/`.
2. In Railway, add PostgreSQL and add an app service from the repo. Select the
   **Dockerfile** builder (not Railpack). Do not override the image start command.
3. Set app service variables `DATABASE_URL=${{Postgres.DATABASE_URL}}` (adjust
   `Postgres` if you renamed the database service) and `PAYLOAD_SECRET` to a
   stable random value generated with `openssl rand -hex 32`. Do not use the
   local `127.0.0.1` database URL. Do not set `NODE_ENV=development`.
   Also set a separate stable `HOUSEHOLD_ACCESS_SECRET` (generate with `openssl rand -hex 32`).
   Set `PUBLIC_SITE_URL` to the final HTTPS website origin, e.g. `https://your-domain.example`,
   before downloading/printing invitation QR codes. These are server runtime variables, not build-time browser variables.
4. Add a persistent volume on the app service at `/app/media` **before uploading
   photos**, and use only one app replica. The entrypoint makes the mounted
   directory writable by the Node user. Back up both the volume and Postgres.
5. Deploy, generate a Railway public domain, and open `/admin` to create the
   first editor account promptly. Anyone reaching the first-user setup before
   you can create that account. Railway provides HTTPS for its public domain.

The container runs `payload migrate` before starting the server, and stops if
migration fails. Completed migrations are skipped on subsequent restarts. After
CMS schema changes, create and commit a new migration with
`npm run payload -- migrate:create <name>` before deploying. Do **not** point
this initial migration at an existing DB previously initialized by `next dev`:
that DB was created by development schema push and may require a separate data
migration. Keep `PAYLOAD_SECRET` stable across deployments.

Email delivery is not configured (password resets and invitations will not
work). Review `npm audit` advisories before wider public use; avoid blindly
running `npm audit fix --force`, which may introduce incompatible downgrades.
