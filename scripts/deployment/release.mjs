import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync, appendFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { imageReference } from './railway.mjs';

const REPOSITORY = 'johnDavid97/vartja';
export function validateRun(run, tagCommit) {
  assert(run.repository?.full_name === REPOSITORY && run.head_repository?.full_name === REPOSITORY, 'Wrong source repository');
  assert(run.path === '.github/workflows/ci.yml' && run.event === 'push' && run.head_branch === 'main', 'Release must come from the main staging pipeline');
  assert(run.status === 'completed' && run.conclusion === 'success', 'Staging pipeline must have succeeded');
  assert(/^[a-f0-9]{40}$/.test(tagCommit) && run.head_sha === tagCommit, 'Tag and staging commit differ');
}
export function validateManifest(manifest, commit, runId) {
  assert(manifest.schema === 1 && manifest.repository === REPOSITORY, 'Unsupported release manifest');
  assert(manifest.commit === commit && String(manifest.runId) === String(runId), 'Manifest provenance mismatch');
  imageReference(manifest.appImage);
  imageReference(manifest.gatewayImage, true);
  return manifest;
}
export function assertReviewers(environment) {
  assert(environment.can_admins_bypass === false, 'Disable administrator bypass for production');
  assert(environment.protection_rules?.some((rule) => rule.type === 'required_reviewers' && rule.reviewers?.length > 0), 'Production requires GitHub environment reviewers');
  assert(environment.deployment_branch_policy?.protected_branches || environment.deployment_branch_policy?.custom_branch_policies, 'Restrict production deployment branches');
}
async function limitedBody(response, maximum) {
  const chunks = []; let size = 0;
  for await (const chunk of response.body) {
    size += chunk.length;
    assert(size <= maximum, 'Release artifact exceeded size limit');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
export async function resolveRelease(env = process.env) {
  assert(env.GITHUB_REPOSITORY === REPOSITORY && env.GITHUB_REF === 'refs/heads/main', 'Run production promotion from main in the canonical repository');
  const tag = env.RELEASE_TAG;
  const runId = env.STAGING_RUN_ID;
  assert(/^v(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/.test(tag || ''), 'Use a version tag such as v1.0.0');
  assert(/^[1-9]\d{0,19}$/.test(runId || ''), 'Invalid staging run ID');
  assert(env.GH_TOKEN && env.GITHUB_OUTPUT, 'GitHub workflow credentials and output file required');
  const api = async (suffix) => {
    const response = await fetch(`https://api.github.com/repos/${REPOSITORY}/${suffix}`, {
      headers: { Authorization: `Bearer ${env.GH_TOKEN}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
      redirect: 'error', signal: AbortSignal.timeout(30_000),
    });
    assert(response.ok, `GitHub release lookup failed (${response.status})`);
    return response.json();
  };
  assertReviewers(await api('environments/production'));
  let ref = (await api(`git/ref/tags/${tag}`)).object;
  for (let i = 0; ref.type === 'tag' && i < 5; i++) ref = (await api(`git/tags/${ref.sha}`)).object;
  assert(ref.type === 'commit', 'Tag must resolve to a commit');
  const run = await api(`actions/runs/${runId}`);
  validateRun(run, ref.sha);
  const artifacts = await api(`actions/runs/${runId}/artifacts?per_page=100`);
  assert(artifacts.total_count <= 100, 'Unexpected artifact count');
  const matches = artifacts.artifacts.filter((item) => item.name === 'staging-release' && !item.expired);
  assert(matches.length === 1, 'A unique, unexpired successful-staging manifest is required');
  const artifact = matches[0];
  assert(Number.isSafeInteger(artifact.id) && artifact.size_in_bytes <= 65_536, 'Unexpected artifact size/identity');
  assert(/^sha256:[a-f0-9]{64}$/.test(artifact.digest || ''), 'Artifact digest is required');
  const response = await fetch(`https://api.github.com/repos/${REPOSITORY}/actions/artifacts/${artifact.id}/zip`, {
    headers: { Authorization: `Bearer ${env.GH_TOKEN}`, Accept: 'application/vnd.github+json' },
    signal: AbortSignal.timeout(30_000),
  });
  assert(response.ok, 'Could not download release artifact');
  const bytes = await limitedBody(response, 65_536);
  assert(`sha256:${createHash('sha256').update(bytes).digest('hex')}` === artifact.digest, 'Artifact digest mismatch');
  const directory = mkdtempSync(path.join(tmpdir(), 'vartja-release-'));
  try {
    const archive = path.join(directory, 'manifest.zip');
    writeFileSync(archive, bytes, { mode: 0o600 });
    const names = execFileSync('unzip', ['-Z1', archive], { encoding: 'utf8', maxBuffer: 4096 }).trim();
    assert(names === 'release.json', 'Unexpected artifact entries');
    const raw = execFileSync('unzip', ['-p', archive, 'release.json'], { encoding: 'utf8', maxBuffer: 16_384 });
    const manifest = validateManifest(JSON.parse(raw), ref.sha, runId);
    appendFileSync(env.GITHUB_OUTPUT, `app_image=${manifest.appImage}\ncommit=${manifest.commit}\n`);
    console.log(`Verified ${tag} against successful staging run ${runId}.`);
    return manifest;
  } finally { rmSync(directory, { recursive: true, force: true }); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  resolveRelease().catch(() => { console.error('Release verification failed; nothing was deployed.'); process.exitCode = 1; });
}
