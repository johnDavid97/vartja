import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

// Own a whole throwaway cluster. Never read .env or connect to an existing DB.
const container = `vartja-ci-db-${randomBytes(6).toString('hex')}`;
assert(/^vartja-ci-db-[a-f0-9]{12}$/.test(container));
const directory = mkdtempSync(path.join(tmpdir(), 'vartja-ci-'));
const password = randomBytes(32).toString('hex');
const envFile = path.join(directory, 'postgres.env');
writeFileSync(envFile, `POSTGRES_PASSWORD=${password}\nPOSTGRES_USER=ci\nPOSTGRES_DB=postgres\n`, { mode: 0o600 });
const suites = [
  'admin-bootstrap', 'admin-security', 'request-security', 'post-poll-rate-limit',
  'household-registration', 'household-admin', 'household-login', 'household-members',
  'program-activity', 'post-comments', 'posts-design', 'wedding-routing', 'wedding-branding',
];
const docker = (...args) => execFileSync('docker', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let success = false;
try {
  docker('run', '-d', '--name', container, '--env-file', envFile, '-p', '127.0.0.1::5432', 'postgres:17-alpine');
  let ready = false;
  for (let i = 0; i < 60; i++) {
    try { docker('exec', container, 'pg_isready', '-U', 'ci', '-d', 'postgres'); ready = true; break; } catch { await delay(500); }
  }
  assert(ready, 'Disposable PostgreSQL failed readiness');
  const port = Number(docker('inspect', '--format', '{{(index (index .NetworkSettings.Ports "5432/tcp") 0).HostPort}}', container));
  assert(Number.isInteger(port) && port > 0 && port < 65536);
  for (const suite of suites) {
    const result = spawnSync(process.execPath, ['--import', 'tsx', `tests/integration/${suite}-isolated.ts`], {
      env: {
        ...process.env,
        DATABASE_URL: `postgresql://ci:${password}@127.0.0.1:${port}/postgres`,
        POSTGRES_PASSWORD: password,
        PAYLOAD_SECRET: randomBytes(48).toString('base64url'),
        HOUSEHOLD_ACCESS_SECRET: randomBytes(48).toString('base64url'),
        PUBLIC_SITE_URL: '',
      },
      encoding: 'utf8', timeout: 600_000, maxBuffer: 20 * 1024 * 1024,
    });
    // Tests may print generated credentials in failure diagnostics. Keep these local,
    // never upload them as public workflow artifacts or print child-process errors.
    writeFileSync(path.join(directory, `${suite}.log`), `${result.stdout || ''}\n${result.stderr || ''}`, { mode: 0o600 });
    assert(result.status === 0, `Disposable suite failed: ${suite}. Private diagnostics: ${directory}`);
    console.log(`PASS: ${suite}`);
  }
  success = true;
} finally {
  try { docker('rm', '-f', container); } catch { /* Name is exclusively owned by this run. */ }
  rmSync(envFile, { force: true });
  if (success) rmSync(directory, { recursive: true, force: true });
}
