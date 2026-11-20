# Deployment readiness

No Railway services or GoDaddy DNS records have been changed. The landing page, repository hygiene and verified deployment fixes were approved for commit, push and merge from `feature/vartja-landing`. This delivery does not deploy the application or authorize DNS changes.

## Completed local preparation

- Static VårtJa landing page, separate wedding routing and branding, and legacy invitation compatibility are implemented and tested.
- Repository hygiene excludes local tooling configuration, credentials and backups from Git/Docker. A previously tracked local configuration file was removed from the index but retained locally. Historical commits were not rewritten.
- Node **22.23.5**, npm **11.19.0**, Payload **3.94.0** and React **19.3.1** are aligned. Next remains **16.4.6**. Clean installation and a valid dependency tree are verified.
- Both full and production-only npm audits report **zero known vulnerabilities** at verification time. See [dependency security](dependency-security.md) for the four temporary transitive overrides, their compatibility tests and limitations.
- The Docker runtime includes migration configuration imports and a complete production dependency tree, without development tools copied back from standalone tracing.
- Container smoke tests use their own disposable PostgreSQL container and fresh secrets, not the populated local database. They verify startup migrations, application routes, persistent media, non-root execution, unchanged migration records on restart and fail-closed migration errors.
- Native login was tested with a synthetic legacy Payload 3.91 password hash. The same password and identity still work; successful login upgrades the hash to Payload's current format. No password reset or schema migration is required for this change.
- The household HTTP boundary preserves Next's internal prerender control flow. The administrator summary waits for an incoming request before initializing Payload, so builds without runtime secrets do not attempt authentication/database initialization. The previous household-error diagnostics are absent from both host and container builds.

## Verification

342 unit tests across 49 files, production build, TypeScript, focused dependency compatibility checks, and disposable routing/landing, branding, login, homepage, household-admin/editor/polls, posts, comments and Program regressions passed. Registration and admin regressions were rerun after the framework error-handling correction. Generated Payload types and import map remained unchanged. Lint has only four existing unused-parameter warnings in the initial migration.

The Docker smoke harness is `tests/integration/container-smoke-isolated.ts`; it creates and cleans its own containers, network, volume and secret environment file. Container verification includes Linux images and a Linux/amd64 build/run for the target deployment architecture. The final complete-production-tree Linux/amd64 image passed the full smoke run, including a valid recursive runtime dependency tree and anonymous/authenticated administrator-summary access checks. Required production peers are retained; TypeScript is intentionally present as a Lexical peer.

## Repository audit

- GitHub repository visibility confirmed PRIVATE.
- Gitleaks scanned reachable Git history and current nonignored files. Four findings were deliberate unit-test dummy values; no live secrets were identified.
- Exact comparisons of current application secrets and the configured database URL against 757 reachable historical blobs found no matches. Values were not printed.
- These checks are evidence, not a guarantee that no unknown vulnerability or secret exists. Recheck before release.

## Required decisions/access before deployment

1. Decide whether to transfer current local wedding content, administrators, households and uploads, or launch an empty installation. Do not assume an empty launch.
2. Renew Railway CLI authentication with `railway login`.
3. Browser tooling is installed outside the repository, with telemetry disabled. Chrome access requires enabling remote debugging at `chrome://inspect/#remote-debugging` and granting connection permission. Login/MFA must be completed directly by the owner.
4. Inspect existing DNS, especially mail records, before applying Railway-provided domain targets. Do not guess apex records or change nameservers unnecessarily.

## Data/deployment safeguards

- Preserve existing data, credentials, sessions and uploads unless an explicit alternative is approved.
- The populated local database has a legacy migration baseline. Never run generic migration replay against it, or against a restored copy without reconciling migration history first.
- Back up and verify any data transfer. Retain the existing household encryption secret when transferring encrypted credentials. Never put secret values in documentation, command output or Git.
- Production needs PostgreSQL and persistent media storage at `/app/media`, secure environment variables, HTTPS and origin-only `PUBLIC_SITE_URL` for the final domain.
- Existing QR URLs still depend on their original host being reachable. Establish the final domain before distributing new invitations.
