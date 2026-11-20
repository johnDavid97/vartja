import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { chromium, type BrowserContext } from "@playwright/test";
import { sql } from "@payloadcms/db-postgres";
import { getPayload } from "payload";
import config from "../../payload.config";
import { activityDigest } from "../../features/guest-activity/digest";
import { activityRateLimitBucket } from "../../features/guest-activity/rate-limit";
import { legacyPostPollQuotaBucket } from "../../features/polls/rate-limit";
import type { PollDefinition } from "../../lib/polls";
import { createAuthenticatedGuest } from "./authenticated-guest";

const databaseURL = new URL(process.env.DATABASE_URL || "");
assert(["localhost", "127.0.0.1"].includes(databaseURL.hostname), "Local databases only");
assert(/^\/sammen_post_poll_rate_limit_test_\d+_[a-f0-9]+$/.test(databaseURL.pathname), "Fresh disposable post-poll database required");
const baseURL = process.env.TEST_BASE_URL || "http://localhost:3122";
assert.equal(new URL(baseURL).origin, "http://localhost:3122");
const payload = await getPayload({ config });
const origin = new URL(baseURL).origin;
const requestHeaders = { Origin: origin };
const poll = (id: string, open = true): PollDefinition => ({
  id, open, question: `Spørsmål ${id}?`,
  options: [{ id: "yes", label: "Ja" }, { id: "no", label: "Nei" }],
});
const body = (...polls: PollDefinition[]) => ({ root: {
  type: "root", version: 1, format: "" as const, indent: 0, direction: null,
  children: polls.map((item) => ({ type: "block", version: 2, format: "", fields: { ...item, blockType: "poll" } })),
} });

const browser = await chromium.launch();
const contexts: BrowserContext[] = [];
const cleanups: Array<() => Promise<void>> = [];
const postIds: number[] = [];
let userId: number | undefined;
let exitCode = 0;

async function quotaRow(bucket: string) {
  const result = await payload.db.drizzle.execute(sql`SELECT attempts, window_start FROM program_activity_limits WHERE bucket_digest=${bucket}`);
  return result.rows[0] as { attempts: string | number; window_start: Date } | undefined;
}

async function contextFrom(storage: Awaited<ReturnType<BrowserContext["storageState"]>>) {
  const context = await browser.newContext({ baseURL, storageState: {
    cookies: storage.cookies.filter((cookie) => cookie.name !== "sammen-poll-voter"), origins: storage.origins,
  } });
  contexts.push(context);
  return context;
}

try {
  const email = `post-poll-limit-${randomUUID()}@example.invalid`;
  const password = randomUUID();
  const administrator = await payload.create({ collection: "users", data: { name: "Poll limit test", email, password } });
  userId = administrator.id;
  const openPoll = poll("open");
  const closedPoll = poll("closed", false);
  const openPost = await payload.create({ collection: "posts", data: { title: "Open poll", description: "Test", visibility: "public", _status: "published", body: body(openPoll, closedPoll, poll("another-open")) } });
  const privatePost = await payload.create({ collection: "posts", data: { title: "Private poll", description: "Test", visibility: "private", _status: "published", body: body(poll("private")) } });
  const draftPost = await payload.create({ collection: "posts", draft: true, data: { title: "Draft poll", description: "Test", body: body(poll("draft")) } });
  postIds.push(openPost.id, privatePost.id, draftPost.id);
  const endpoint = `/api/posts/${openPost.id}/polls/${openPoll.id}`;

  const householdBase = await browser.newContext({ baseURL }); contexts.push(householdBase);
  const householdA = await createAuthenticatedGuest({ payload, context: householdBase, administratorId: administrator.id, baseURL });
  cleanups.push(householdA.cleanup);
  const householdStorage = await householdBase.storageState();
  const bucketA = legacyPostPollQuotaBucket(payload, householdA.householdId);
  const oldSharedBucket = activityDigest(payload, "write-quota", ["household", householdA.householdId]);
  await payload.db.drizzle.execute(sql`
    INSERT INTO program_activity_limits (bucket_digest, window_start, attempts, created_at, updated_at)
    VALUES (${oldSharedBucket}, date_trunc('minute', now()), 9, now(), now())
  `);

  // Reads and all existing denials happen before quota consumption.
  assert((await householdBase.request.get(endpoint)).ok());
  assert.equal((await householdBase.request.post(endpoint, { headers: requestHeaders, data: { optionId: "missing" } })).status(), 400);
  assert.equal((await householdBase.request.post(`/api/posts/${openPost.id}/polls/${closedPoll.id}`, { headers: requestHeaders, data: { optionId: "yes" } })).status(), 409);
  assert.equal((await householdBase.request.post(`/api/posts/${privatePost.id}/polls/private`, { headers: requestHeaders, data: { optionId: "yes" } })).status(), 404);
  assert.equal((await householdBase.request.post(`/api/posts/${draftPost.id}/polls/draft`, { headers: requestHeaders, data: { optionId: "yes" } })).status(), 404);
  assert.equal(await quotaRow(bucketA), undefined);

  // Distinct valid signed browser cookies share the server-derived household bucket.
  const voters: BrowserContext[] = [];
  for (let index = 0; index < 20; index += 1) {
    const voter = await contextFrom(householdStorage); voters.push(voter);
    const response = await voter.request.post(endpoint, { headers: requestHeaders, data: {
      optionId: "yes", householdId: 900000 + index, voterId: `claimed-${index}`, sessionToken: `claimed-${index}`,
    } });
    assert(response.ok(), `New ballot ${index + 1} should be accepted`);
  }
  const denied = await contextFrom(householdStorage);
  const limited = await denied.request.post(endpoint, { headers: requestHeaders, data: { optionId: "yes", householdId: -1 } });
  assert.equal(limited.status(), 429);
  assert.equal(limited.headers()["retry-after"], "60");
  assert.match(limited.headers()["cache-control"] || "", /private.*no-store/);
  assert.match(limited.headers().vary || "", /Cookie/i);
  assert(limited.headers()["set-cookie"]?.includes("sammen-poll-voter="), "Denied new voters retain their signed voter cookie");
  assert.equal(Number((await quotaRow(bucketA))?.attempts), 20);
  const differentPoll = await denied.request.post(`/api/posts/${openPost.id}/polls/another-open`, {
    headers: requestHeaders, data: { optionId: "yes" },
  });
  assert.equal(differentPoll.status(), 429, "Changing polls must not reset the household quota");

  const firstBallot = (await payload.find({ collection: "poll-votes", overrideAccess: true, depth: 0, limit: 1, where: { post: { equals: openPost.id } } })).docs[0];
  assert(firstBallot);
  const fingerprint = { id: firstBallot.id, voteKey: firstBallot.voteKey, definition: firstBallot.definition };
  const retry = await voters[0].request.post(endpoint, { headers: requestHeaders, data: { optionId: "no", householdId: -999 } });
  assert(retry.ok(), "A persisted browser ballot must remain accessible at the limit");
  assert.equal((await retry.json()).selectedOption, "yes", "A retry cannot replace the browser's original choice");
  assert.equal(Number((await quotaRow(bucketA))?.attempts), 20, "Persisted retry must not consume quota");
  const unchanged = await payload.findByID({ collection: "poll-votes", id: firstBallot.id, overrideAccess: true, depth: 0 });
  assert.deepEqual({ id: unchanged.id, voteKey: unchanged.voteKey, definition: unchanged.definition }, fingerprint);

  // A second approved household has an independent bucket.
  const secondBase = await browser.newContext({ baseURL }); contexts.push(secondBase);
  const householdB = await createAuthenticatedGuest({ payload, context: secondBase, administratorId: administrator.id, baseURL });
  cleanups.push(householdB.cleanup);
  const secondVote = await secondBase.request.post(endpoint, { headers: requestHeaders, data: { optionId: "no", householdId: householdA.householdId } });
  assert(secondVote.ok());
  const bucketB = legacyPostPollQuotaBucket(payload, householdB.householdId);
  assert.equal(Number((await quotaRow(bucketB))?.attempts), 1);
  assert.equal(Number((await quotaRow(bucketA))?.attempts), 20);

  // A real quota-storage failure must fail closed before creating a ballot.
  const ballotsBeforeFailure = (await payload.count({ collection: "poll-votes", overrideAccess: true })).totalDocs;
  const failingVoter = await contextFrom(await secondBase.storageState());
  await payload.db.drizzle.execute(sql`CREATE FUNCTION test_fail_poll_quota() RETURNS trigger
    LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Synthetic quota storage failure'; END $$`);
  await payload.db.drizzle.execute(sql`CREATE TRIGGER test_fail_poll_quota
    BEFORE INSERT OR UPDATE ON program_activity_limits FOR EACH ROW EXECUTE FUNCTION test_fail_poll_quota()`);
  try {
    const unavailable = await failingVoter.request.post(endpoint, { headers: requestHeaders, data: { optionId: "yes" } });
    assert.equal(unavailable.status(), 503, "Quota-storage errors must fail closed");
    assert.match(unavailable.headers()["cache-control"] || "", /private.*no-store/);
    assert.match(unavailable.headers().vary || "", /Cookie/i);
    const message = await unavailable.text();
    assert.equal(message.includes(bucketB), false, "Quota responses must not disclose bucket identifiers");
    assert.equal(message.includes("Synthetic"), false, "Quota responses must not disclose database errors");
    assert.equal((await payload.count({ collection: "poll-votes", overrideAccess: true })).totalDocs, ballotsBeforeFailure);
    assert.equal(Number((await quotaRow(bucketB))?.attempts), 1);
  } finally {
    await payload.db.drizzle.execute(sql`DROP TRIGGER test_fail_poll_quota ON program_activity_limits`);
    await payload.db.drizzle.execute(sql`DROP FUNCTION test_fail_poll_quota()`);
  }

  // Trusted native administrators stay exempt even with fresh browser voter cookies.
  const admin = await browser.newContext({ baseURL }); contexts.push(admin);
  assert((await admin.request.post("/api/users/login", { headers: requestHeaders, data: { email, password } })).ok());
  for (let index = 0; index < 22; index += 1) {
    await admin.clearCookies({ name: "sammen-poll-voter" });
    assert((await admin.request.post(endpoint, { headers: requestHeaders, data: { optionId: "yes" } })).ok());
  }
  const adminBucket = activityRateLimitBucket(payload, "legacy-post-poll-write-quota", { kind: "administrator", id: administrator.id });
  assert.equal(await quotaRow(adminBucket), undefined);

  // Reset only this test's household bucket by SQL, then prove the conditional upsert under concurrency.
  const ballotsBeforeConcurrent = (await payload.count({ collection: "poll-votes", overrideAccess: true, where: { post: { equals: openPost.id } } })).totalDocs;
  await payload.db.drizzle.execute(sql`
    UPDATE program_activity_limits
    SET attempts=20, window_start=date_trunc('minute', now()) - interval '1 minute'
    WHERE bucket_digest=${bucketA}
  `);
  const concurrentContexts = await Promise.all(Array.from({ length: 25 }, () => contextFrom(householdStorage)));
  const concurrent = await Promise.all(concurrentContexts.map((context, index) => context.request.post(endpoint, {
    headers: requestHeaders, data: { optionId: index % 2 ? "yes" : "no", householdId: householdB.householdId },
  })));
  assert.equal(concurrent.filter((response) => response.ok()).length, 20);
  assert.equal(concurrent.filter((response) => response.status() === 429).length, 5);
  assert.equal((await payload.count({ collection: "poll-votes", overrideAccess: true, where: { post: { equals: openPost.id } } })).totalDocs, ballotsBeforeConcurrent + 20);
  assert.equal(Number((await quotaRow(bucketA))?.attempts), 20);
  assert.equal(Number((await quotaRow(bucketB))?.attempts), 1, "SQL reset must not touch another household");
  assert.equal(Number((await quotaRow(oldSharedBucket))?.attempts), 9, "Program/comment namespace must remain untouched");

  console.log("PASS: isolated legacy post-poll household attempt quota, validation ordering, retries, concurrency, reset, namespaces and administrator exemption.");
} catch (error) {
  console.error(error);
  exitCode = 1;
} finally {
  await Promise.allSettled(contexts.map((context) => context.close()));
  await browser.close();
  await Promise.allSettled(cleanups.map((cleanup) => cleanup()));
  for (const id of postIds) await payload.delete({ collection: "posts", id, overrideAccess: true }).catch(() => undefined);
  if (userId) await payload.delete({ collection: "users", id: userId, overrideAccess: true }).catch(() => undefined);
  await payload.destroy();
  process.exit(exitCode);
}
