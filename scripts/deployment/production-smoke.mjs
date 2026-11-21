import assert from 'node:assert/strict';

// Public readiness only. Ingress protection and recovery must already have been
// independently verified before PRODUCTION_READY is enabled.
try {
  const origin = 'https://xn--vrtja-mra.no';
  for (const route of ['/', '/andrea-og-martin/login']) {
    const response = await fetch(`${origin}${route}`, { redirect: 'manual', signal: AbortSignal.timeout(20_000) });
    assert(response.status === 200, 'Public production page is unavailable');
  }
  const privateAPI = await fetch(`${origin}/api/household-summary`, { redirect: 'manual', signal: AbortSignal.timeout(20_000) });
  assert(privateAPI.status === 403, 'Private administrator summary must reject anonymous access');
  assert(privateAPI.headers.get('cache-control')?.includes('no-store'), 'Private responses must not be cached');
  console.log('PASS: production TLS, public pages and anonymous permission boundary.');
} catch {
  console.error('Production smoke check failed. Inspect the deployment; do not blindly revert database migrations.');
  process.exitCode = 1;
}
