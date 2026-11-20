# Dependency and container security baseline

## Supported toolchain

Use Node **22.23.5** (`.node-version`) and npm **11.19.0**. Docker pins the same versions. With fnm, run `fnm use` before installing or testing.

- Payload packages are aligned and pinned to **3.94.0**.
- React and React DOM are pinned to **19.3.1**; Next stays on **16.4.6**.
- The lockfile is generated under the supported toolchain, without npm's `--force` or `--legacy-peer-deps` install flags.
- Vite's optional `esbuild` and `yaml` peers are explicitly pinned as development dependencies. Without these pins, npm selected incompatible versions from unrelated tools despite reporting a successful installation.
- `shadcn` is a build/development dependency, not an application runtime dependency.

## Temporary transitive overrides

Current stable parents still require vulnerable dependency versions. These overrides intentionally exceed the parents' declared ranges; they are tested project compatibility choices, not claims of upstream support. Remove them when patched parent releases admit safe versions, after rerunning verification.

| Parent/use | Override | Reason and execution check |
| --- | --- | --- |
| Lexical headless DOM adapter | `happy-dom` 21.0.4 | Fixes the reported execution/SSRF advisories. Test imports formatted HTML and exports it through Lexical's actual DOM adapter. |
| Monaco browser sanitizer | `dompurify` 3.4.18 | Fixes reported sanitizer bypasses. Chromium test loads the package resolved by Monaco and verifies safe markup survives while scripts, event handlers and executable links are removed. |
| Legacy Drizzle loader | `@esbuild-kit/core-utils` → `esbuild` 0.25.12 | Removes the vulnerable old esbuild version. Both synchronous and asynchronous loader transformations execute a typed fixture. |
| Build-time source tooling | `@ts-morph/common` → `minimatch` 11.0.9 | Fixes reported glob denial of service. Test exercises inclusion, brace expansion and exclusions through the actual parent filesystem API. |

Happy DOM is not used as a DOMPurify server sanitizer. The two packages have different roles; DOMPurify compatibility is checked in its actual browser environment.

## Checks

```sh
npm ci
npm ls --all
npm audit
npm audit --omit=dev
npm test
npm run test:dependency-compatibility
npm run build
npx tsc --noEmit
npm run lint
```

Successful installation alone is not sufficient: the dependency tree must also be valid. Audit results are time-sensitive and must be rechecked before release. A zero advisory count is not a guarantee that software has no vulnerabilities.

The existing disposable integration runners cover registration/login, admin permissions and forms, drafts/publication, posts, comments, polls, Program, branding and routing. Never point them at a populated database. Generated Payload types and import-map output must remain unchanged unless a separately reviewed schema/component change requires otherwise.

## Container verification

```sh
docker build -t samen-railway-check .
node --import tsx tests/integration/container-smoke-isolated.ts
```

`CONTAINER_SMOKE_IMAGE` can select another locally built image. This test creates its own PostgreSQL container, network and media volume with random guarded resource names and fresh credentials. It does not read `.env` or connect to the existing database. Cleanup removes only its disposable resources.

The runtime image installs production dependencies separately with `--omit=dev`, retaining Payload's production `tsx` dependency for migrations, and copies the source imported by the runtime config. The standalone-traced dependency tree is replaced completely with this production install, rather than merged or selectively pruned. Do not use `--omit=peer`: date-fns, Monaco and Yjs are required production peers. TypeScript remains intentionally installed as a Lexical production peer. Development tools such as shadcn and Playwright are excluded. The entrypoint migrates before starting Next; migration failure must prevent serving traffic. It fixes ownership on the media mount, then runs migrations and the server as the non-root `node` user.

The smoke test checks the recursive production dependency tree, initial migration, HTTP routes, anonymous/admin summary access, native login and rehash of a synthetic legacy password, media persistence across container replacement, unchanged migration records on the second startup, non-root execution and failed-migration startup behavior. It is a deployment test, not permission to migrate an existing legacy-baseline database.
