import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { imageReference, railwayClient, assertPrivateApplication, deployImage, deploy, PROJECT_ID, ENVIRONMENTS } from '../../scripts/deployment/railway.mjs';
import { validateRun, validateManifest, assertReviewers } from '../../scripts/deployment/release.mjs';

const appImage = `ghcr.io/johndavid97/vartja@sha256:${'a'.repeat(64)}`;
const gatewayImage = `ghcr.io/johndavid97/vartja-staging-gateway@sha256:${'b'.repeat(64)}`;
const serviceId = '11111111-1111-4111-8111-111111111111';
const deploymentId = '22222222-2222-4222-8222-222222222222';
const state = () => ({ serviceInstance: { serviceName: 'app', service: { projectId: PROJECT_ID }, source: { image: appImage, repo: null }, domains: { customDomains: [], serviceDomains: [] } }, tcpProxies: [] });
const run = () => ({ repository: { full_name: 'johnDavid97/vartja' }, head_repository: { full_name: 'johnDavid97/vartja' }, path: '.github/workflows/ci.yml', event: 'push', head_branch: 'main', status: 'completed', conclusion: 'success', head_sha: 'c'.repeat(40) });

test('only immutable, canonical application/gateway image references are accepted', () => {
  assert.equal(imageReference(appImage), appImage);
  assert.equal(imageReference(gatewayImage, true), gatewayImage);
  for (const value of ['ghcr.io/other/app@sha256:' + 'a'.repeat(64), appImage + '\n', appImage.replace('@sha256:', ':latest'), gatewayImage, '', undefined]) {
    assert.throws(() => imageReference(value));
  }
});
test('Railway client uses project scope and fails closed on HTTP/GraphQL errors without leaking responses', async () => {
  let seen;
  const api = railwayClient('disposable-token-fixture', async (url, options) => { seen = { url, options }; return Response.json({ data: { ok: true } }); });
  assert.deepEqual(await api('query { ok }'), { ok: true });
  assert.equal(seen.url, 'https://backboard.railway.com/graphql/v2');
  assert.equal(seen.options.headers['Project-Access-Token'], 'disposable-token-fixture');
  assert.equal(seen.options.headers.Authorization, undefined);
  for (const response of [Response.json({ errors: [{ message: 'private-value' }] }), new Response('private-value', { status: 403 })]) {
    await assert.rejects(railwayClient('disposable-token-fixture', async () => response)('query { ok }'), (error) => !error.message.includes('private-value'));
  }
});
test('direct application domains, TCP proxies and repository builds are rejected', () => {
  assert.doesNotThrow(() => assertPrivateApplication(state()));
  for (const mutate of [s => s.tcpProxies.push({ id: 'proxy' }), s => s.serviceInstance.domains.customDomains.push({ domain: 'bypass.test' }), s => s.serviceInstance.domains.serviceDomains.push({ domain: 'bypass.up.railway.app' }), s => { s.serviceInstance.source.repo = 'owner/repo'; }, s => { s.serviceInstance.serviceName = 'web'; }]) {
    const value = state(); mutate(value); assert.throws(() => assertPrivateApplication(value));
  }
});
test('a wrong environment token is rejected before any service mutation', async () => {
  const calls = [];
  await assert.rejects(deploy('staging', {}, async (query) => { calls.push(query); return { projectToken: { projectId: PROJECT_ID, environmentId: ENVIRONMENTS.production } }; }));
  assert.equal(calls.length, 1);
});
test('production is disabled until explicitly marked ready', async () => {
  const calls = [];
  const api = async (query) => { calls.push(query); return query.includes('projectToken') ? { projectToken: { projectId: PROJECT_ID, environmentId: ENVIRONMENTS.production } } : state(); };
  await assert.rejects(deploy('production', { APP_IMAGE: appImage, RAILWAY_APP_SERVICE_ID: serviceId }, api));
  assert(calls.every(q => !q.startsWith('mutation')));
});
test('deployment pins the image, polls the returned ID and verifies configured image', async () => {
  const calls = [];
  const api = async (query, variables) => {
    calls.push({ query, variables });
    if (query.includes('serviceInstanceUpdate')) return { serviceInstanceUpdate: true };
    if (query.includes('serviceInstanceDeployV2')) return { serviceInstanceDeployV2: deploymentId };
    if (query.includes('deployment(id:')) return { deployment: { id: deploymentId, status: 'SUCCESS', environmentId: ENVIRONMENTS.staging, serviceId } };
    return state();
  };
  assert.equal(await deployImage(api, { serviceId, environmentId: ENVIRONMENTS.staging, image: appImage, healthcheckPath: '/' }), deploymentId);
  assert.equal(calls[0].variables.input.source.image, appImage);
  assert.equal(calls[2].variables.id, deploymentId);
});
test('failed update/deployment never silently succeeds or retries mutations', async () => {
  let calls = 0;
  await assert.rejects(deployImage(async () => { calls++; return { serviceInstanceUpdate: false }; }, { serviceId, environmentId: ENVIRONMENTS.staging, image: appImage, healthcheckPath: '/' }));
  assert.equal(calls, 1);
  let mutationCount = 0;
  await assert.rejects(deployImage(async (query) => {
    if (query.includes('serviceInstanceUpdate')) { mutationCount++; return { serviceInstanceUpdate: true }; }
    if (query.includes('serviceInstanceDeployV2')) { mutationCount++; return { serviceInstanceDeployV2: deploymentId }; }
    return { deployment: { status: 'FAILED', serviceId, environmentId: ENVIRONMENTS.staging } };
  }, { serviceId, environmentId: ENVIRONMENTS.staging, image: appImage, healthcheckPath: '/' }, { attempts: 1, delay: async () => {} }));
  assert.equal(mutationCount, 2);
});
test('promotion requires the exact successful main push run, never a PR/fork/rebuilt tag', () => {
  assert.doesNotThrow(() => validateRun(run(), 'c'.repeat(40)));
  for (const patch of [{ event: 'pull_request' }, { event: 'workflow_dispatch' }, { head_branch: 'feature/test' }, { conclusion: 'failure' }, { status: 'in_progress' }, { path: '.github/workflows/other.yml' }, { head_sha: 'd'.repeat(40) }, { head_repository: { full_name: 'other/fork' } }]) {
    assert.throws(() => validateRun({ ...run(), ...patch }, 'c'.repeat(40)));
  }
});
test('manifest is bound to the repository, commit, run and immutable images', () => {
  const m = { schema: 1, repository: 'johnDavid97/vartja', commit: 'c'.repeat(40), runId: '123', appImage, gatewayImage };
  assert.equal(validateManifest(m, m.commit, '123'), m);
  for (const patch of [{ schema: 2 }, { repository: 'other/repo' }, { commit: 'd'.repeat(40) }, { runId: '124' }, { appImage: 'latest' }]) assert.throws(() => validateManifest({ ...m, ...patch }, m.commit, '123'));
});
test('production requires native environment reviewers, branch rules and no bypass', () => {
  const e = { can_admins_bypass: false, deployment_branch_policy: { custom_branch_policies: true }, protection_rules: [{ type: 'required_reviewers', reviewers: [{ type: 'User' }] }] };
  assert.doesNotThrow(() => assertReviewers(e));
  for (const patch of [{ can_admins_bypass: true }, { protection_rules: [] }, { deployment_branch_policy: null }]) assert.throws(() => assertReviewers({ ...e, ...patch }));
});
test('workflow trust boundaries: PRs have no deployment job, production uses approval and no rebuild', () => {
  const ci = parse(readFileSync('.github/workflows/ci.yml', 'utf8'));
  const productionText = readFileSync('.github/workflows/production.yml', 'utf8');
  const production = parse(productionText);
  assert.deepEqual(ci.permissions, { contents: 'read' });
  assert(!ci.on.pull_request_target && !ci.on.workflow_run);
  assert(ci.jobs.staging.if.includes("github.event_name == 'push'"));
  assert(ci.jobs.staging.if.includes("github.ref == 'refs/heads/main'"));
  assert.equal(ci.jobs.staging.concurrency['cancel-in-progress'], false);
  assert.equal(production.jobs.production.environment.name, 'production');
  assert.equal(production.jobs.production.needs, 'verify-release');
  assert(!productionText.includes('docker build'));
  for (const workflow of [ci, production]) for (const job of Object.values(workflow.jobs)) for (const step of job.steps) {
    if (step.uses && !step.uses.startsWith('./')) assert.match(step.uses, /@[a-f0-9]{40}$/);
  }
  const stages = ci.jobs.staging.steps;
  assert(stages.findIndex(s => s.run === 'node scripts/deployment/staging-smoke.mjs') < stages.findIndex(s => s.name === 'Record successful staging provenance'));
});
