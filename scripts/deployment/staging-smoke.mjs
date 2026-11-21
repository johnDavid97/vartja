import assert from 'node:assert/strict';

const origin = 'https://staging.xn--vrtja-mra.no';
const { STAGING_SMOKE_USER: user, STAGING_SMOKE_PASSWORD: password } = process.env;
assert(user && password, 'Staging test credentials are required');
const authorization = `Basic ${Buffer.from(`${user}:${password}`).toString('base64')}`;
async function request(path, authenticated = false, options = {}) {
  return fetch(`${origin}${path}`, {
    ...options, redirect: 'manual', signal: AbortSignal.timeout(20_000),
    headers: { ...options.headers, ...(authenticated ? { authorization } : {}) },
  });
}
try {
  for (const path of ['/', '/admin', '/api/users/login', '/api/globals/wedding', '/api/media/file/probe.png', '/_next/static/probe.js']) {
    const response = await request(path);
    assert(response.status === 401, 'A staging route was not gated');
    assert(response.headers.get('cache-control')?.includes('no-store'), 'Staging must not be cached');
  }
  for (const path of ['/', '/admin', '/andrea-og-martin/login']) {
    assert((await request(path, true)).status === 200, 'Authenticated staging page failed');
  }
  assert((await request('/api/household-summary', true)).status === 403, 'Gateway login must not grant administrator access');
  const registration = await request('/api/users/first-register', true, {
    method: 'POST', headers: { 'content-type': 'application/json', origin }, body: '{}',
  });
  assert(registration.status === 403, 'Public administrator bootstrap must remain closed');
  console.log('PASS: staging TLS, access gate, authenticated pages and native permission boundaries.');
} catch {
  console.error('Hosted staging verification failed. No credentials or response bodies were logged.');
  process.exitCode = 1;
}
