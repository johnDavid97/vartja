import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { chromium, expect, type Browser, type Route } from "@playwright/test";
import { getPayload, type CollectionBeforeChangeHook } from "payload";
import { sql } from "@payloadcms/db-postgres";
import config from "../../payload.config";
import { createAuthenticatedGuest } from "./authenticated-guest";

assert(["localhost", "127.0.0.1"].includes(new URL(process.env.DATABASE_URL || "").hostname));
assert(new URL(process.env.DATABASE_URL!).pathname.includes("post_comments"), "Disposable database only");
const baseURL = process.env.TEST_BASE_URL || "http://localhost:3109";
const payload = await getPayload({ config });
const headers = { Origin: new URL(baseURL).origin };
let browser: Browser | undefined;
let exitCode = 0;
try {
  const email = `comments-${randomUUID()}@example.invalid`;
  const password = randomUUID();
  const user = await payload.create({ collection: "users", data: { name: "Andrea", email, password } });
  const post = await payload.create({ collection: "posts", data: { title: "Praktisk informasjon", description: "Vi gleder oss til å se dere!", _status: "published", visibility: "public" } });
  const second = await payload.create({ collection: "posts", data: { title: "Neste innlegg", description: "En annen samtale.", _status: "published", visibility: "public" } });
  const draft = await payload.create({ collection: "posts", draft: true, data: { title: "Unpublished", description: "Not for guests" } });
  const privatePost = await payload.create({ collection: "posts", data: { title: "Private", description: "Not for guests", visibility: "private", _status: "published" } });
  await payload.updateGlobal({ slug: "program", data: { _status: "published", itinerary: { days: [{ id: String(post.id), date: "2027-07-27", label: "Bryllupsdagen", items: [] }] } } });
  browser = await chromium.launch();
  const admin = await browser.newContext({ baseURL });
  const guest = await browser.newContext({ baseURL });
  const anonymous = await browser.newContext({ baseURL });
  assert((await admin.request.post("/api/users/login", { data: { email, password } })).ok());
  const household = await createAuthenticatedGuest({ payload, context: guest, administratorId: user.id, baseURL });
  const page = await guest.newPage();
  const editor = await admin.newPage();
  const errors: string[] = [];
  for (const tab of [page, editor]) tab.on("pageerror", (error) => errors.push(error.message));
  const endpoint = `/api/posts/${post.id}/comments`;
  const secondEndpoint = `/api/posts/${second.id}/comments`;
  const dayEndpoint = `/api/program-days/${post.id}/comments`;
  const input = (body: string, parentId: number | null = null) => ({ requestKey: randomUUID(), body, parentId });
  assert.equal((await anonymous.request.get(endpoint)).status(), 403);
  for (const id of [draft.id, privatePost.id, 2147483647]) {
    assert.equal((await guest.request.get(`/api/posts/${id}/comments?draft=true`)).status(), 404);
    assert.equal((await admin.request.post(`/api/posts/${id}/comments`, { headers, data: input("No") })).status(), 404);
  }
  assert.equal((await guest.request.get("/api/posts/2147483648/comments")).status(), 404);
  await page.goto(`/news/${post.id}`);
  const comments = page.getByRole("region", { name: "Kommentarer", exact: true });
  await comments.getByLabel("Legg til en kommentar", { exact: true }).fill("Kan vi ta med barna?");
  await comments.getByRole("button", { name: "Kommenter", exact: true }).click();
  await expect(comments.getByRole("status")).toHaveText("Kommentaren er lagt til.");
  const first = (await (await guest.request.get(endpoint)).json()).comments[0];
  assert.equal(first.body, "Kan vi ta med barna?");
  const tamper = await admin.request.patch(`/api/program-comments/${first.id}`, { data: { body: "Rewritten", authorName: "Impersonated", source: "program-day", dayId: String(post.id), postId: second.id } });
  assert(tamper.ok(), await tamper.text());
  const unchanged = await payload.findByID({ collection: "program-comments", id: first.id });
  assert.equal(unchanged.body, first.body); assert.equal(unchanged.authorName, first.authorName);
  assert.equal(unchanged.source, "post"); assert.equal(unchanged.postId, post.id); assert.equal(unchanged.dayId, null);
  assert(!JSON.stringify(first).includes("@example.invalid"));
  assert.equal((await (await guest.request.get(secondEndpoint)).json()).comments.length, 0);
  assert.equal((await (await guest.request.get(dayEndpoint)).json()).comments.length, 0);
  assert.equal((await guest.request.post(secondEndpoint, { headers, data: input("Wrong post", first.id) })).status(), 400);
  assert.equal((await guest.request.post(dayEndpoint, { headers, data: input("Wrong source", first.id) })).status(), 400);
  assert.equal((await guest.request.post(endpoint, { headers, data: { ...input("Forged"), authorName: "Andrea", postId: second.id } })).status(), 400);
  assert.equal((await guest.request.post(endpoint, { headers: { Origin: "https://evil.invalid" }, data: input("CSRF") })).status(), 403);
  const replay = input("Vi gleder oss!");
  const repeated = await Promise.all([guest.request.post(endpoint, { headers, data: replay }), guest.request.post(endpoint, { headers, data: replay })]);
  assert(repeated.every((response) => response.ok()));
  assert.equal((await repeated[0].json()).id, (await repeated[1].json()).id);
  assert.equal((await guest.request.post(secondEndpoint, { headers, data: replay })).status(), 409);
  assert.equal((await guest.request.post(dayEndpoint, { headers, data: replay })).status(), 409);
  await editor.goto(`/news/${post.id}`);
  const adminComments = editor.getByRole("region", { name: "Kommentarer", exact: true });
  await adminComments.getByRole("article").filter({ hasText: "Kan vi ta med barna?" }).getByRole("button", { name: "Svar", exact: true }).click();
  await adminComments.getByLabel("Skriv et svar", { exact: true }).fill("Ja, barna er også invitert!");
  await adminComments.getByRole("button", { name: "Send svar", exact: true }).click();
  await expect(adminComments.getByRole("status")).toHaveText("Kommentaren er lagt til.");
  await adminComments.getByRole("article").filter({ hasText: "Kan vi ta med barna?" }).getByRole("button", { name: "Skjul kommentar", exact: true }).click();
  await expect(adminComments.getByText("Kommentaren er skjult av brudeparet.", { exact: true })).toBeVisible();
  const hidden = (await (await guest.request.get(endpoint)).json()).comments[0];
  assert.equal(hidden.body, ""); assert.equal(hidden.authorName, "");
  assert.equal((await guest.request.patch(endpoint, { headers, data: { id: first.id, status: "published" } })).status(), 403);
  await adminComments.getByRole("button", { name: "Vis kommentar", exact: true }).click();
  await expect(adminComments.getByText("Kan vi ta med barna?", { exact: true })).toBeVisible();
  await page.reload();
  await expect(comments.getByText("Ja, barna er også invitert!", { exact: true })).toBeVisible();
  // Lost-response retry uses the same shared composer and request key.
  let lose = true;
  const intercept = async (route: Route) => {
    if (route.request().method() !== "POST" || !lose) return route.continue();
    lose = false;
    assert((await route.fetch()).ok());
    await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Tapt svar" }) });
  };
  await page.route(`**${endpoint}`, intercept);
  await comments.getByLabel("Legg til en kommentar", { exact: true }).fill("Kommentar med tapt svar");
  await comments.getByRole("button", { name: "Kommenter", exact: true }).click();
  await expect(comments.getByRole("alert")).toHaveText("Tapt svar");
  await comments.getByRole("button", { name: "Prøv igjen", exact: true }).click();
  await expect(comments.getByRole("status")).toHaveText("Kommentaren er lagt til.");
  assert.equal((await (await guest.request.get(endpoint)).json()).comments.filter((comment: { body: string }) => comment.body === "Kommentar med tapt svar").length, 1);
  await page.unroute(`**${endpoint}`, intercept);
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: `/tmp/sammen-post-comments-${width}.png`, fullPage: true });
  }
  await editor.goto(`/admin/collections/posts/${post.id}`);
  const enabled = editor.getByRole("checkbox", { name: "Tillat kommentarer", exact: true });
  await expect(enabled).toBeChecked();
  const moderation = editor.getByRole("link", { name: "Se og moderer innleggets kommentarer", exact: true });
  await expect(moderation).toHaveAttribute("href", new RegExp(`postId.*=${post.id}`));
  async function save(label: string) {
    const response = editor.waitForResponse((response) => response.url().includes(`/api/posts/${post.id}`) && response.request().method() === "PATCH");
    await editor.getByRole("button", { name: label, exact: true }).click();
    const result = await response; assert(result.ok(), await result.text());
  }
  await enabled.uncheck();
  await save("Lagre utkast");
  assert.equal((await (await guest.request.get(endpoint)).json()).enabled, true);
  await save("Publiser endringer");
  assert.equal((await (await guest.request.get(endpoint)).json()).enabled, false);
  assert.equal((await guest.request.post(endpoint, { headers, data: input("Closed") })).status(), 409);
  await page.reload();
  await expect(comments.getByText("Kommentarer er stengt her.", { exact: true })).toBeVisible();
  await expect(comments.getByText("Kan vi ta med barna?", { exact: true })).toBeVisible();
  await expect(comments.getByRole("button", { name: "Kommenter", exact: true })).toHaveCount(0);
  for (const width of [1440, 390]) {
    await editor.setViewportSize({ width, height: 1000 });
    await enabled.scrollIntoViewIfNeeded();
    assert(await editor.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await editor.screenshot({ path: `/tmp/sammen-post-comments-admin-${width}.png`, fullPage: true });
  }
  await moderation.click();
  await expect(editor.getByRole("row").filter({ hasText: "Kan vi ta med barna?" })).toBeVisible();
  await payload.update({ collection: "posts", id: post.id, data: { commentsEnabled: true, _status: "published" } });
  // Native visibility updates and comment creation must share the same transaction lock.
  let entered!: () => void; let release!: () => void;
  const waiting = new Promise<void>((resolve) => { entered = resolve; });
  const held = new Promise<void>((resolve) => { release = resolve; });
  const barrier: CollectionBeforeChangeHook = async ({ data, context }) => { if (context.commentRaceProbe) { entered(); await held; } return data; };
  const hooks = payload.collections.posts.config.hooks.beforeChange!;
  hooks.push(barrier);
  try {
    const update = payload.update({ collection: "posts", id: post.id, context: { commentRaceProbe: true }, data: { visibility: "private", _status: "published" } });
    await waiting;
    let finished = false;
    const writing = guest.request.post(endpoint, { headers, data: input("Must not appear after privatizing") }).then((response) => { finished = true; return response; });
    await new Promise((resolve) => setTimeout(resolve, 100));
    assert.equal(finished, false);
    release();
    await update;
    assert.equal((await writing).status(), 404);
  } finally { release(); hooks.splice(hooks.indexOf(barrier), 1); }
  assert.equal((await guest.request.get(endpoint)).status(), 404);
  await payload.update({ collection: "posts", id: post.id, data: { visibility: "public", _status: "published" } });
  const countBefore = await payload.count({ collection: "program-comments", where: { postId: { equals: post.id } } });
  await payload.delete({ collection: "posts", id: post.id });
  assert.equal((await guest.request.get(endpoint)).status(), 404);
  assert.equal((await payload.count({ collection: "program-comments", where: { postId: { equals: post.id } } })).totalDocs, countBefore.totalDocs);
  // Quota is shared with Program activity, not reset by moving between surfaces.
  await payload.db.drizzle.execute(sql`UPDATE program_activity_limits SET attempts=20, window_start=date_trunc('minute', now())`);
  assert.equal((await guest.request.post(secondEndpoint, { headers, data: input("Limited") })).status(), 429);
  await payload.update({ collection: "households", id: household.householdId, data: { status: "pending" } });
  assert.equal((await guest.request.get(secondEndpoint)).status(), 403);
  assert.deepEqual(errors, []);
  console.log("PASS: shared post comments/replies/moderation, per-post/day isolation, published/private/draft access, retry safety, draft-aware controls, visibility/write serialization, retained deletion history, quota and responsive layouts.");
} catch (error) { console.error(error); exitCode = 1; }
finally { await browser?.close(); process.exit(exitCode); }
