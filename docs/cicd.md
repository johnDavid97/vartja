# GitHub Actions and protected staging

## Status and release boundary

The canonical public repository is `johnDavid97/vartja`. The workflows and staging gateway are implemented here, but must be committed, reviewed and configured before their first hosted run. Local tests are not evidence that GitHub Actions or Railway deployment has run successfully.

Production is deliberately blocked until its ingress, domain, backups/recovery and administrator bootstrap are separately verified. This batch does **not** implement the production ingress gateway or provision production. Never enable `PRODUCTION_READY` merely to bypass a failing job.

## Pipeline

`.github/workflows/ci.yml`:

1. Pull requests and pushes to `main` run lint, unit/deployment tests, dependency audit, production build, TypeScript and disposable integration suites.
2. PRs additionally build Linux/amd64 app/gateway images and test the actual containers. PR jobs have no deployment credentials or package-write permissions. There is no `pull_request_target` or privileged `workflow_run` path.
3. On canonical `main`, `CD_ENABLED=true` enables the staging job. It builds and tests the images before publishing to GHCR; it does not rebuild the images after testing.
4. `STAGING_DEPLOY_ENABLED=true` additionally deploys those exact image digests through Railway's API. A main-head check prevents an already-stale run from rolling staging back. Deployment jobs are serialized and not cancelled mid-migration.
5. Only after Railway deployment and hosted TLS/access smoke checks succeed does the workflow upload `staging-release/release.json`. This contains source commit/run and immutable image references, not credentials. It expires after 90 days; expired/missing artifacts cannot be promoted.

`.github/workflows/production.yml` is manually dispatched **from main** with an existing `vMAJOR.MINOR.PATCH` tag and a successful staging run ID. It verifies:

- The run belongs to this repository, was a main push through the expected workflow, and completed successfully.
- The tag, run and manifest identify the same commit.
- The unique unexpired artifact has the expected SHA-256 digest, contains only `release.json`, and has bounded compressed/decompressed sizes.
- Both image references are pinned digests from the expected GHCR packages.
- The production environment has required reviewers, branch restrictions and administrator bypass disabled.

The production job then waits for GitHub's native environment approval, obtains its **production-only** Railway token and promotes the same application image without rebuilding. Either designated reviewer can approve. Self-review may remain allowed so either operator can explicitly approve a release they initiated. Set the exact deployment branch policy to `main`; the script also refuses dispatches from other refs.

All external Actions are pinned to reviewed commit SHAs. A successful local mock/API-schema check does not replace the first real Actions run. Runtime mutation errors are intentionally not dumped into public job logs. A failure does not automatically roll back schema changes.

## Railway staging topology

Three services, in the **staging** environment only:

| Service | Exposure | Storage/source |
| --- | --- | --- |
| `web` | `staging.vårtja.no`, target port 3000 | Tested staging gateway image |
| `app` | Private `app.railway.internal:3000` only | Tested app image; volume at `/app/media` |
| PostgreSQL | Private networking only | Separate persistent PostgreSQL volume |

Keep direct GitHub/Railway builds, image auto-updates and serverless sleeping disabled for these app/gateway services. Use one app replica while using a local media volume. Do not attach any public/default domain or TCP proxy to `app`; the deployment script refuses these bypasses. It also refuses a public TCP proxy or default service domain on `web`. PostgreSQL must not have a public TCP proxy either; verify this during provisioning.

The gateway listens on 3000 as UID 1000, has its admin API disabled, uses two bcrypt accounts, and fails closed if its configuration is missing or invalid. Its only anonymous endpoint is `GET/HEAD /__gateway_health`, returning a fixed `ok` without proxying application data. Everything else requires authentication, including APIs, media and static assets. Noncanonical hostnames are rejected. All staging responses are marked private/no-store and noindex.

Railway terminates public HTTPS; the private hop is HTTP over Railway's encrypted network. The gateway fixes forwarded host/protocol rather than trusting client-supplied values. Basic credentials and the `Forwarded` header are removed before proxying; cookies, request Origin, body, method and query remain intact. Native Payload administrator and household permissions are still required. Staging clients must use native **cookies**, because the outer Basic gate consumes the Authorization header; it is not a replacement for Payload authentication.

### Gateway variables

- `PORT=3000`
- `PUBLIC_HOST=staging.xn--vrtja-mra.no`
- `GATE_USER_ONE`, `GATE_USER_TWO`: distinct short alphanumeric/underscore/hyphen usernames.
- `GATE_HASH_ONE`, `GATE_HASH_TWO`: bcrypt hashes, cost 10–16, of separate strong passwords.

Generate each password in a password manager. Hash it with the tested Caddy version using stdin or the interactive `caddy hash-password` command; never put plaintext in command arguments, Git, screenshots or chat. Store the two plaintext passwords separately for the two testers. Hashes belong in Railway variables. Restart/redeploy the gateway after changing a hash; password rotation must not modify Payload users or household credentials.

### Application variables

- `PORT=3000`, `HOSTNAME=::`, `NODE_ENV=production`
- `PUBLIC_SITE_URL=https://staging.xn--vrtja-mra.no` (origin only)
- `DATABASE_URL`: private PostgreSQL connection, generated for staging, never copied from `.env`.
- Independent fresh `PAYLOAD_SECRET` and `HOUSEHOLD_ACCESS_SECRET`.

The existing entrypoint migrates the fresh database and fails closed on error, then runs the server as a non-root user. It does not seed administrators or wedding data. Never point it at the populated legacy local database.

### DNS/TLS prerequisite

Railway requires **both** the staging CNAME and the ownership TXT record shown by its domain configuration. A propagated CNAME alone is insufficient. The TXT host is `_railway-verify.staging`; retrieve its current value from Railway, not this document. Do not change root-domain, mail or nameserver records. Confirm Railway reports ownership verified and that a normal HTTPS client validates its certificate before enabling deployment smoke checks. Never use `curl -k` as proof of readiness.

## GitHub configuration and first deployment

No long-lived account-wide Railway token belongs in Actions. Create separate **project tokens scoped to the staging and production environments**; the deployer checks both project and environment IDs before any mutation. Do not copy the operator CLI account token into CI.

Create GitHub environments:

- `staging`: deployment branch `main`; no manual approval for routine deployments.
- `production`: deployment branch `main`, both designated GitHub users as required reviewers (one approval suffices), administrator bypass disabled. Do not enable deployment until production-specific readiness has passed.

Secrets and variables are environment-scoped:

| Environment | Name | Kind |
| --- | --- | --- |
| staging | `RAILWAY_TOKEN` | Secret: staging-scoped project token |
| staging | `RAILWAY_APP_SERVICE_ID` | Variable: `app` service ID |
| staging | `RAILWAY_GATEWAY_SERVICE_ID` | Variable: `web` service ID |
| staging | `STAGING_SMOKE_USER`, `STAGING_SMOKE_PASSWORD` | Secrets: one authorized gate account, **not** a Payload administrator |
| staging | `STAGING_DEPLOY_ENABLED` | Variable: enable only after provisioning/public image visibility/TLS |
| production | `RAILWAY_TOKEN` | Secret: production-scoped project token |
| production | `RAILWAY_APP_SERVICE_ID` | Variable: private production app instance's service ID |
| production | `PRODUCTION_READY` | Variable: leave absent/false until reviewed production readiness |
| repository | `CD_ENABLED` | Variable: `true` enables image publishing after main checks |

GHCR packages initially default to private even for public source repositories. First run the main pipeline with `CD_ENABLED=true` and staging deployment disabled. Review the two published images and explicitly make **both** `vartja` and `vartja-staging-gateway` packages public. Confirm anonymous pulls work. Railway Hobby can then pull these images without a registry token. A public repository alone does not make its container packages public.

After configuring staging and verifying DNS/TLS, enable `STAGING_DEPLOY_ENABLED` and rerun the same main push workflow (or merge the next reviewed change). A publish-only run has no successful-staging artifact and cannot be promoted.

Protect main against force pushes/deletion and require the `checks` and `container-check` PR jobs before merging. Do not push old backup refs or the original checkout's legacy security worktree into the public repository. For this working copy, `public` is the new public remote; `origin` is the private original. Push only explicitly reviewed clean branch refs.

## Initial accounts, backups and reset

- Bootstrap native administrators privately using `admin:bootstrap`, never a public first-register endpoint. Verify the chosen Railway operator transport forwards **non-TTY stdin without echoing it**, using harmless fixture input first, before sending a credential JSON file. SSH stdin behavior is not established by local Docker tests.
- Staging gets fictional persistent data only. Do not migrate local wedding/household data or production data into it.
- Before storing meaningful staging content, configure backups for PostgreSQL **and** `/app/media`; back up runtime encryption secrets separately using secure storage. Check the plan's actual backup schedule/retention rather than assuming defaults.
- Verify a restore into a disposable isolated environment, including media, credentials and native login, before production readiness. Never test restore by overwriting staging/production or the populated local database.
- A staging reset is an explicit destructive operator action, not an automatic workflow: confirm the staging environment IDs; preserve/export anything wanted; restore a reviewed fictional baseline or replace only staging DB/media resources; migrate the fresh DB; privately bootstrap again. No reset command is provided until its exact resource guards and confirmation flow are reviewed.
- Image rollback does not undo migrations. Inspect compatibility and backups before deploying an earlier digest. Do not automatically execute migration-down on a populated database after a failed deployment.

## Local verification

```sh
npm run test:deployment
docker build --platform linux/amd64 -t vartja-staging-gateway:test infra/staging-gateway
npm run test:staging-gateway
npm run build
npm run test:ci-integrations
```

The CI integration runner owns a new randomly named Docker PostgreSQL container, publishes only a random loopback port, supplies fresh synthetic secrets, and removes that container afterward. It never reads `.env` and runs integration suites serially against guarded disposable databases. Failure diagnostics stay in an owner-only temporary directory and are not uploaded to public Actions artifacts. Container tests likewise use their own database/network/media volume. Existing development resources are not reset.
