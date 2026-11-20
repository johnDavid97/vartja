# Administrator security configuration

## Public origin

`PUBLIC_SITE_URL` is the single origin trusted for the Payload administrator:

- Hosted deployments must set an exact HTTPS origin, for example `https://bryllup.example`.
- Internationalized hostnames are canonicalized to their URL/punycode origin.
- Credentials, paths, queries, fragments, wildcards and hosted HTTP URLs are rejected at configuration load.
- HTTP is accepted only for `localhost`, `127.0.0.0/8` and `::1`, for disposable local development and tests.
- A missing or blank value uses the explicit `http://localhost:3000` fallback so local development and environment-free builds can load configuration. A hosted deployment left on that fallback will not trust its hosted origin.

The canonical origin is Payload's `serverURL`, sole sanitized CSRF origin and sole CORS origin. `serverURL` is deliberately fixed so security-sensitive URLs are never derived from a request `Host` header. No proxy, preview or secondary environment-origin variables are trusted.

## Administrator cookies

The native Users auth cookie keeps Payload's `HttpOnly` and `SameSite=Lax` behavior. `Secure` is enabled when `PUBLIC_SITE_URL` is HTTPS. Explicit HTTP loopback configuration permits non-Secure cookies for local client compatibility. The missing-origin fallback permits this only in development/test mode; production and unknown modes retain Secure cookies even when the origin was omitted.

Payload's existing session mode, token expiry, secret and password hashing remain unchanged.

## Password policy

Every newly supplied administrator password must contain at least 15 characters. This applies to the private bootstrap command, later creates, password-changing updates and password resets. Existing password hashes are not modified:

- existing shorter passwords can still log in;
- an administrator can edit a name or other non-password field without supplying a password;
- no forced rotation is introduced.

The Users collection overrides Payload's special password field with one hidden virtual text field. It delegates required and maximum-length checks to Payload's native password validator and adds the 15-character minimum. The field is virtual and hidden, so it creates no database column and no duplicate admin input. Payload 3.94's reset operation explicitly invokes this override validator before hashing; a collection `beforeValidate` hook alone would not cover resets because that later hook receives the stored user object without the plaintext password.

## Private first-administrator bootstrap

Public first-user registration is permanently denied in every environment. `Users` defines a `POST /first-register` endpoint that returns a generic Norwegian 403 response with `Cache-Control: private, no-store`. Payload 3.94 sanitization appends native auth endpoints after configured collection endpoints, and its endpoint dispatcher selects the first matching method/path. The denial therefore shadows the native registration handler even when the database is empty or after the last user is deleted. Regular authenticated administrator creation keeps the existing `Users.access.create` rule.

Payload strips a trailing slash before matching. Encoded spellings do not match the literal custom or native route, other HTTP methods do not match the native POST route, and Payload's POST-to-GET method override is processed before dispatch and therefore cannot reach either POST handler. Generic REST/GraphQL user creation remains subject to collection create access. Recheck these installed-source assumptions on Payload upgrades; there is no separate public bootstrap route enabled by this project.

The only initial-account path is an operator command with runtime `DATABASE_URL`, `PAYLOAD_SECRET` and the other required server secrets already present in the process environment:

Prepare a UTF-8 JSON object containing `name`, `email` and a unique password-manager-generated `password` in a private file **outside the repository**, with permissions `0600`. Do not construct it using a shell command containing the password. Use an `.env.`-prefixed filename for defense in depth: those files are excluded from Git and Docker contexts.

```bash
# Select the intended service/environment explicitly; stdin is forwarded over SSH.
railway ssh --service app --environment production -- npm run admin:bootstrap \
  < /secure/path/.env.bootstrap-admin.json

# Local Docker equivalent, running as the application user:
docker exec -i --user node <container-name> npm run admin:bootstrap \
  < /secure/path/.env.bootstrap-admin.json
```

Remove the temporary file afterward and retain the credentials in your password manager. [Railway SSH](https://docs.railway.com/cli/ssh) supports piped input without a PTY; authentication and SSH-key registration remain operator-controlled. Do not put real credentials in shell history. The command does not load `.env`; an operator who deliberately uses a local env file must do so explicitly (for example, with Node's `--env-file` in a separately reviewed invocation). It rejects TTY input because a hidden interactive prompt is not implemented, rejects arguments and unknown fields, and never accepts password arguments, environment password variables or defaults. It prints neither credentials nor tokens and suppresses Payload logging/unknown error details.

The helper uses Payload validation and password hashing. One Payload transaction and shared request cover a PostgreSQL transaction-level advisory lock, the user count, and creation. The helper explicitly selects READ COMMITTED isolation so waiters see the preceding committed account even if the database defaults to repeatable read. Calls serialize across processes and creation is refused if any user exists; it never updates or resets an account. Transactional failures roll back, including safe cleanup when native creation has already rolled back. Because the installed Payload adapter can swallow a COMMIT rejection, a fresh read outside the transaction must confirm the account before success is reported. A connection failure after commit can leave the outcome uncertain: check native login before retrying; existing accounts are never overwritten. The command exits nonzero for invalid input, an initialized database, or operational failure and always closes Payload resources.

In the Docker image, run the command privately through Railway SSH or `docker exec`; `scripts/` is copied into the runner. The entrypoint never invokes it and no bootstrap credential is embedded in the image or environment.

## Upgrade checks

When upgrading Payload, regress these source-dependent integration points before deployment:

1. collection sanitization still appends native auth endpoints after custom endpoints, and endpoint dispatch still selects the first method/path match;
2. trailing-slash, URL-decoding and method-override handling cannot route around the custom first-register denial;
3. `resetPasswordOperation` still invokes the configured password field validator before hashing;
4. auth collection sanitization still retains one hidden virtual `password` override;
5. the native auth UI still owns the password/confirmation controls (no duplicate field);
6. generated TypeScript reflects the virtual operation/select property, but the database must not acquire a stored password column or require a migration. This change reorders the existing `User.password` operation property and adds `UsersSelect.password`; neither represents stored plaintext;
7. native cookies remain `HttpOnly` and `SameSite=Lax`, with `Secure` matching the configured origin.

## Verification and scope

Run `npm run test:admin-bootstrap` and `npm run test:admin-security` after a production build. The bootstrap suite checks permanent public denial, concurrency under an initially repeatable-read transaction, authenticated creation, deletion of the final user, stdin-only CLI behavior and a real deferred database constraint that rejects COMMIT. Its guarded runner creates its own local database and fresh authentication secrets. It checks public first-user denial and private initial-account/create/update/reset validation, successful strong-password updates, unchanged legacy short-password login, reset session revocation, absence of a stored/exposed plaintext password, native password/confirmation controls, HTTP/HTTPS cookie flags, and CORS preflights. A real browser submits a same-site foreign-origin multipart form with its administrator cookie present; the server must return 403 and create no user, while a trusted-origin control succeeds. The same build is used for both local HTTP and configured HTTPS-origin processes.

Verified: 368 unit tests across 51 files, build, TypeScript, lint (four existing migration warnings), the dedicated bootstrap and security suites, existing household/admin/editor/poll/branding/routing/homepage/comment/Program regressions, and Linux/amd64 container migration/startup/restart/media/legacy-login checks. No real wedding records or credentials were modified.

Public first-user bootstrap is closed; native API body limits and legacy post-poll identity/throttling remain separate tasks. This document is not a declaration that hosting is ready.
