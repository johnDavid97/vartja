import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { request } from 'node:http';

const image = process.env.GATEWAY_TEST_IMAGE || 'vartja-staging-gateway:test';
const prefix = `vartja-gateway-${randomBytes(6).toString('hex')}`;
const network = `${prefix}-network`;
const backend = `${prefix}-backend`;
const gateway = `${prefix}-gateway`;
const invalid = `${prefix}-invalid`;
const directory = mkdtempSync(path.join(tmpdir(), 'vartja-gateway-'));
const passwords = [randomBytes(24).toString('hex'), randomBytes(24).toString('hex')];
function docker(args, input) {
  try { return execFileSync('docker', args, { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim(); }
  catch { throw new Error('Disposable gateway Docker operation failed (output withheld).'); }
}
const hash = (password) => docker(['run', '--rm', '-i', '--entrypoint', 'caddy', image, 'hash-password'], `${password}\n`);
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const environment = {
  PUBLIC_HOST: 'staging.example.test', GATE_USER_ONE: 'tester-one', GATE_USER_TWO: 'tester-two',
  GATE_HASH_ONE: hash(passwords[0]), GATE_HASH_TWO: hash(passwords[1]),
};
const envFile = path.join(directory, 'gateway.env');
writeFileSync(envFile, Object.entries(environment).map(([key, value]) => `${key}=${value}`).join('\n'), { mode: 0o600 });
try {
  docker(['network', 'create', network]);
  docker(['run', '-d', '--name', backend, '--network', network, '--network-alias', 'app.railway.internal', 'node:22.23.5-alpine', 'node', '-e', `
    require('http').createServer(async (req,res) => {
      let body=''; for await (const part of req) body+=part;
      res.setHeader('Cache-Control','public, max-age=3600');
      res.setHeader('Set-Cookie','payload-token=fixture; HttpOnly; Secure; SameSite=Lax; Path=/');
      res.end(JSON.stringify({method:req.method,url:req.url,headers:req.headers,body}));
    }).listen(3000,'0.0.0.0');
  `]);
  docker(['run', '-d', '--name', gateway, '--network', network, '--env-file', envFile, '-p', '127.0.0.1::3000', image]);
  const port = Number(docker(['inspect', '--format', '{{(index (index .NetworkSettings.Ports "3000/tcp") 0).HostPort}}', gateway]));
  assert(Number.isInteger(port) && port > 0);
  const base = `http://127.0.0.1:${port}`;
  const call = (route, options = {}) => new Promise((resolve, reject) => {
    const req = request(`${base}${route}`, {
      method: options.method || 'GET', signal: AbortSignal.timeout(10_000),
      headers: { host: environment.PUBLIC_HOST, ...options.headers },
    }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve(new Response(Buffer.concat(chunks), { status: res.statusCode, headers: res.headers })));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.end(options.body);
  });
  let ready = false;
  for (let i = 0; i < 60; i++) {
    try { if ((await call('/__gateway_health')).status === 200) { ready = true; break; } } catch { /* starting */ }
    await pause(250);
  }
  assert(ready, 'Gateway failed readiness');
  for (const route of ['/', '/admin', '/api/users/login', '/api/users/first-register', '/api/globals/wedding', '/api/media/file/test.png', '/andrea-og-martin', '/_next/static/test.js', '/%61dmin', '/api/%75sers/login']) {
    const response = await call(route);
    assert.equal(response.status, 401, `Ungated route: ${route}`);
    assert.match(response.headers.get('www-authenticate') || '', /^Basic /);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
  }
  assert.equal((await call('/api/users/login', { method: 'OPTIONS' })).status, 401);
  assert.equal((await call('/__gateway_health', { method: 'POST' })).status, 401);
  const credentials = (i) => `Basic ${Buffer.from(`${i ? 'tester-two' : 'tester-one'}:${passwords[i]}`).toString('base64')}`;
  assert.equal((await call('/', { headers: { authorization: 'Basic invalid' } })).status, 401);
  assert.equal((await call('/', { headers: { authorization: credentials(0), host: 'bypass.up.railway.app' } })).status, 404);
  for (let i = 0; i < 2; i++) {
    const response = await call('/api/posts?limit=1', {
      method: 'POST', body: JSON.stringify({ probe: true }),
      headers: { authorization: credentials(i), cookie: 'payload-token=fixture', origin: 'https://staging.example.test', 'content-type': 'application/json', 'x-forwarded-host': 'evil.invalid', 'x-forwarded-proto': 'http', forwarded: 'host=evil.invalid' },
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    assert.match(response.headers.get('set-cookie') || '', /HttpOnly; Secure; SameSite=Lax/);
    const echoed = await response.json();
    assert.equal(echoed.url, '/api/posts?limit=1');
    assert.equal(echoed.method, 'POST');
    assert.equal(echoed.body, JSON.stringify({ probe: true }));
    assert.ok(echoed.headers.authorization === undefined, 'Gateway leaked Basic credentials upstream');
    assert.equal(echoed.headers.forwarded, undefined);
    assert.equal(echoed.headers['x-forwarded-host'], environment.PUBLIC_HOST);
    assert.equal(echoed.headers['x-forwarded-proto'], 'https');
    assert.equal(echoed.headers.cookie, 'payload-token=fixture');
    assert.equal(echoed.headers.origin, 'https://staging.example.test');
  }
  for (const override of ['GATE_HASH_TWO=', 'GATE_USER_TWO=tester-one', 'PUBLIC_HOST=bad host', 'GATE_HASH_ONE=not-a-hash']) {
    const status = docker(['run', '-d', '--name', invalid, '--network', network, '--env-file', envFile, '-e', override, image]);
    assert(status);
    assert.notEqual(docker(['wait', invalid]), '0', 'Invalid configuration must fail closed');
    docker(['rm', invalid]);
  }
  assert.equal(docker(['exec', gateway, 'id', '-u']), '1000');
  console.log('PASS: staging gateway authentication, both accounts, no domain bypass, header/cookie/body preservation, non-root and fail-closed startup.');
} finally {
  for (const name of [invalid, gateway, backend]) { try { docker(['rm', '-f', name]); } catch { /* already removed */ } }
  try { docker(['network', 'rm', network]); } catch { /* not created */ }
  rmSync(directory, { recursive: true, force: true });
}
