# Deployment readiness

The cleaned source is public at `johnDavid97/vartja`; the original `johnDavid97/sammen` repository remains private. Railway has the VårtJa project, isolated staging/production environments, and an empty staging `web` service. The staging CNAME is configured; Railway ownership TXT verification and valid HTTPS still need completion. No application or database has been deployed.

GitHub Actions workflows, pinned-image promotion checks and the two-account staging gateway are implemented locally; see [CI/CD and staging](cicd.md). They are not yet pushed, configured or executed on GitHub/Railway. Production ingress and backup/restore verification remain separate readiness requirements.

## Completed local preparation

- Static VårtJa landing page, separate wedding routing and branding, and legacy invitation compatibility are implemented and tested.
- Repository hygiene excludes local tooling configuration, credentials and backups from Git/Docker. A previously tracked local configuration file was removed from the index but retained locally. Historical commits were not rewritten.
- Node **22.23.5**, npm **11.19.0**, Payload **3.94.0** and React **19.3.1** are aligned. Next remains **16.4.6**. Clean installation and a valid dependency tree are verified.
- Both full and production-only npm audits report **zero known vulnerabilities** at verification time. See [dependency security](dependency-security.md) for the four temporary transitive overrides, their compatibility tests and limitations.
- The Docker runtime includes migration configuration imports and a complete production dependency tree, without development tools copied back from standalone tracing.
- Container smoke tests use their own disposable PostgreSQL container and fresh secrets, not the populated local database. They verify startup migrations, application routes, persistent media, non-root execution, unchanged migration records on restart and fail-closed migration errors.
- Native login was tested with a synthetic legacy Payload 3.91 password hash. The same password and identity still work; successful login upgrades the hash to Payload's current format. No password reset or schema migration is required for this change.
- The household HTTP boundary preserves Next's internal prerender control flow. The administrator summary waits for an incoming request before initializing Payload, so builds without runtime secrets do not attempt authentication/database initialization. The previous household-error diagnostics are absent from both host and container builds.

- Administrator hardening now configures an exact trusted origin, HTTPS-secure cookies and a 15-character minimum for new passwords, preserving existing passwords and identities. Public first-user setup is permanently closed; initial administrators are created with a private stdin-only operator command, not automatic deployment seeding. See [administrator security](admin-security.md) for current verification and operating instructions. No schema migration is needed.

## Verification

The landing/dependency delivery passed 342 unit tests across 49 files, production build, TypeScript, focused dependency compatibility checks, and disposable routing/landing, branding, login, homepage, household-admin/editor/polls, posts, comments and Program regressions passed. Registration and admin regressions were rerun after the framework error-handling correction. Generated Payload types and import map remained unchanged. Lint has only four existing unused-parameter warnings in the initial migration.

The Docker smoke harness is `tests/integration/container-smoke-isolated.ts`; it creates and cleans its own containers, network, volume and secret environment file. Container verification includes Linux images and a Linux/amd64 build/run for the target deployment architecture. The final complete-production-tree Linux/amd64 image passed the full smoke run, including a valid recursive runtime dependency tree and anonymous/authenticated administrator-summary access checks. Required production peers are retained; TypeScript is intentionally present as a Lexical peer.

## Repository audit

- Canonical GitHub repository `johnDavid97/vartja` is PUBLIC with reviewed, cleaned history. The original repository and original-history backup remain PRIVATE. Public GHCR package visibility must be configured separately before Railway Hobby can pull images.
- Gitleaks scanned reachable Git history and current nonignored files. Four findings were deliberate unit-test dummy values; no live secrets were identified.
- Exact comparisons of current application secrets and the configured database URL against 757 reachable historical blobs found no matches. Values were not printed.
- These checks are evidence, not a guarantee that no unknown vulnerability or secret exists. Recheck before release.

## Agreed environment and release model

- Keep local development separate from hosted staging and production, with distinct databases, uploads, credentials and secrets.
- Production starts empty: do not transfer local administrators, test households or wedding content. Bootstrap its initial administrator privately.
- Staging stays online, restricted to the two designated testers, with persistent fictional data and an explicit reset procedure. Never copy production guest data into staging.
- Main will deploy to staging after automated checks. A version tag and a successful staging run identify the exact tested image; GitHub's production environment requires explicit approval by a designated reviewer. The workflows and staging access gateway are implemented locally, with hosted configuration/verification still pending. Production deployment is disabled until its independent safeguards are verified.

## Required work/access before deployment

1. Establish and verify trusted-ingress login protection, implement protected staging and the approved release pipeline, and verify backups and recovery. Native REST body limits and durable legacy poll write-rate limits are implemented locally; see [request security](request-security.md) and [polls](../features/polls/README.md). They do not replace ingress request-rate/concurrency controls or prove individual voter identity.
2. Provision the fresh staging database, private app service and persistent media volume. Configure independent runtime secrets, gateway accounts and environment-scoped deployment tokens without logging values. Operator authentication/MFA remains owner-controlled.
3. Configure GitHub environments, protected main checks, public package visibility and the designated production reviewers. Complete private administrator bootstrap only through a verified non-echoing operator transport.
4. Complete the Railway-provided staging TXT ownership record and verify TLS. Existing root, email and nameserver records must remain untouched. Production DNS is a separate approved step.

## Data/deployment safeguards

- Preserve existing local data, credentials, sessions and uploads. An empty production launch is approved; deleting or resetting the local database is not.
- The populated local database has a legacy migration baseline. Never run generic migration replay against it, or against a restored copy without reconciling migration history first.
- Back up and verify any data transfer. Retain the existing household encryption secret when transferring encrypted credentials. Never put secret values in documentation, command output or Git.
- Production needs PostgreSQL and persistent media storage at `/app/media`, secure environment variables, HTTPS and origin-only `PUBLIC_SITE_URL` for the final domain.
- Existing QR URLs still depend on their original host being reachable. Establish the final domain before distributing new invitations.
