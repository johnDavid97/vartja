# Andrea & Martin — wedding website

Next.js website with a self-hosted Payload CMS and PostgreSQL.

## Local development

1. Install dependencies: `npm ci`.
2. Create `.env` using `.env.example` if it does not already exist.
   Generate separate random values for the database password and Payload secret
   with `openssl rand -hex 32`. Use the same database password in `DATABASE_URL`.
   Never commit `.env`.
3. Start Docker Desktop, then run:

   ```bash
   npm run db:up
   npm run dev
   ```

4. Open **http://localhost:3000/admin** and create the first account.
   Do this locally before exposing the app to the internet.
5. Use the dashboard shortcuts to edit **Bryllupsinformasjon** or create an **Innlegg**.

The first account is created through Payload's first-user setup. After that,
only signed-in editors can create accounts. All accounts are trusted editors
with the same permissions; do not create guest accounts here.

## Editing the website

- **Bryllupsinformasjon**: names, date and welcome text are connected to the homepage.
  Schedule and travel fields are saved but their dedicated public pages are not connected yet.
- **Innlegg**: enter a title and description, optionally choose/upload a photo.
  **Save Draft** keeps the post private. **Publish** makes it appear under **Nytt fra oss**
  on the homepage. The homepage shows the 12 most recently created published posts.
- **Bilder**: upload JPEG, PNG or WebP images up to 10 MB. Add a short image description.
  All uploaded files are public, even when attached to a draft. Do not upload sensitive files.
- **Redaktører**, under settings: accounts for trusted editors only.

Visitors see saved/published changes when they open or refresh the homepage.
This is not live push updating of an already-open browser tab.
Polls, RSVP, invitation sending, and password-reset email are not configured.

## Files

- `app/(website)/` — existing website pages, layout and styles. URLs are unchanged.
- `app/(payload)/` — isolated admin layout and Payload REST API.
- `payload.config.ts` — CMS configuration and database connection.
- `collections/Users.ts` — editor accounts and access rules.
- `globals/Wedding.ts` — editable wedding details and schedule.
- `collections/Posts.ts` — draft/published guest updates.
- `collections/Media.ts` — public photo uploads.
- `components/admin/` — dashboard welcome panel and branding.
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
```

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
