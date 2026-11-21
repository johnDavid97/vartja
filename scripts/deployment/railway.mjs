import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

export const PROJECT_ID = '3639f449-4b38-41df-92b0-81210806371f';
export const ENVIRONMENTS = {
  staging: 'dc349f9e-724c-4472-adf8-34beb0ab16a3',
  production: 'aec549d0-a110-4ac5-8fd3-d0b8a96c2cba',
};
const UUID = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
export function imageReference(value, gateway = false) {
  const prefix = `ghcr.io/johndavid97/vartja${gateway ? '-staging-gateway' : ''}@sha256:`;
  assert(typeof value === 'string' && value.startsWith(prefix) && /^[a-f0-9]{64}$/.test(value.slice(prefix.length)), 'Expected a pinned VartJa image digest');
  return value;
}
export function railwayClient(token, fetcher = fetch) {
  assert(typeof token === 'string' && token.length > 10, 'An environment-scoped Railway project token is required');
  return async (query, variables = {}) => {
    const response = await fetcher('https://backboard.railway.com/graphql/v2', {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(30_000),
      headers: { 'Content-Type': 'application/json', 'Project-Access-Token': token, 'User-Agent': 'VartJa-release' },
      body: JSON.stringify({ query, variables }),
    });
    assert(response.ok, `Railway HTTP failure (${response.status})`);
    const result = await response.json();
    // Never print server error bodies: they can include configuration or secrets.
    assert(!result.errors?.length && result.data, 'Railway operation failed; inspect the Railway dashboard');
    return result.data;
  };
}
export async function inspectService(api, serviceId, environmentId) {
  assert(UUID.test(serviceId || ''), 'Invalid Railway service ID');
  return api(`query($serviceId:String!,$environmentId:String!){
    serviceInstance(serviceId:$serviceId,environmentId:$environmentId){
      serviceName source {image repo} service {projectId}
      domains {customDomains {domain targetPort} serviceDomains {domain}}
    }
    tcpProxies(serviceId:$serviceId,environmentId:$environmentId){id}
  }`, { serviceId, environmentId });
}
export function assertPrivateApplication(state) {
  const service = state.serviceInstance;
  assert(service.service.projectId === PROJECT_ID && service.serviceName === 'app', 'Unexpected application service');
  assert(!service.source?.repo, 'Disable direct GitHub builds before image deployments');
  assert(service.domains.customDomains.length === 0 && service.domains.serviceDomains.length === 0 && state.tcpProxies.length === 0, 'Application must have no public domains or TCP proxies');
}
export async function deployImage(api, { serviceId, environmentId, image, healthcheckPath }, { delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms)), attempts = 90 } = {}) {
  const updated = await api(`mutation($serviceId:String!,$environmentId:String!,$input:ServiceInstanceUpdateInput!){
    serviceInstanceUpdate(serviceId:$serviceId,environmentId:$environmentId,input:$input)
  }`, { serviceId, environmentId, input: { source: { image }, healthcheckPath, healthcheckTimeout: 300 } });
  assert(updated.serviceInstanceUpdate === true, 'Railway did not apply the pinned image configuration');
  const deployed = await api(`mutation($serviceId:String!,$environmentId:String!){
    serviceInstanceDeployV2(serviceId:$serviceId,environmentId:$environmentId)
  }`, { serviceId, environmentId });
  const id = deployed.serviceInstanceDeployV2;
  assert(UUID.test(id || ''), 'Railway did not return a deployment ID');
  for (let i = 0; i < attempts; i++) {
    const { deployment } = await api(`query($id:String!){deployment(id:$id){id status environmentId serviceId}}`, { id });
    assert(deployment.environmentId === environmentId && deployment.serviceId === serviceId, 'Deployment identity mismatch');
    if (deployment.status === 'SUCCESS') {
      const state = await inspectService(api, serviceId, environmentId);
      assert(state.serviceInstance.source?.image === image, 'Image changed during deployment');
      return id;
    }
    assert(!['FAILED', 'CRASHED', 'REMOVED', 'SKIPPED'].includes(deployment.status), 'Railway deployment failed');
    await delay(10_000);
  }
  throw new Error('Railway deployment timed out; do not retry blindly—inspect its status first');
}
export async function deploy(environment, env = process.env, api = railwayClient(env.RAILWAY_TOKEN)) {
  assert(environment === 'staging' || environment === 'production', 'Invalid deployment environment');
  const environmentId = ENVIRONMENTS[environment];
  const { projectToken } = await api('query { projectToken { projectId environmentId } }');
  assert(projectToken.projectId === PROJECT_ID && projectToken.environmentId === environmentId, 'Wrong Railway token scope');
  const appId = env.RAILWAY_APP_SERVICE_ID;
  const appImage = imageReference(env.APP_IMAGE);
  const before = await inspectService(api, appId, environmentId);
  assertPrivateApplication(before);
  if (environment === 'production') {
    // This is not a substitute for GitHub environment reviewers or an ingress audit.
    assert(env.PRODUCTION_READY === 'true', 'Production ingress, backups, domain and bootstrap must be approved first');
  } else {
    const gateway = await inspectService(api, env.RAILWAY_GATEWAY_SERVICE_ID, environmentId);
    assert(gateway.serviceInstance.service.projectId === PROJECT_ID && gateway.serviceInstance.serviceName === 'web', 'Unexpected gateway');
    assert(!gateway.serviceInstance.source?.repo && gateway.tcpProxies.length === 0, 'Gateway must be image-managed with no TCP exposure');
    assert(gateway.serviceInstance.domains.serviceDomains.length === 0, 'Remove default gateway domains');
    const domains = gateway.serviceInstance.domains.customDomains;
    assert(domains.length === 1 && domains[0].domain === 'staging.xn--vrtja-mra.no' && domains[0].targetPort === 3000, 'Unexpected staging domain');
    imageReference(env.GATEWAY_IMAGE, true);
  }
  const appDeployment = await deployImage(api, { serviceId: appId, environmentId, image: appImage, healthcheckPath: '/' });
  assertPrivateApplication(await inspectService(api, appId, environmentId));
  if (environment === 'staging') {
    await deployImage(api, { serviceId: env.RAILWAY_GATEWAY_SERVICE_ID, environmentId, image: env.GATEWAY_IMAGE, healthcheckPath: '/__gateway_health' });
  }
  console.log(`Deployment successful: ${environment} (${appDeployment})`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  deploy(process.argv[2]).catch(() => { console.error('Deployment failed. Check configuration and Railway deployment status; no automatic rollback was attempted.'); process.exitCode = 1; });
}
