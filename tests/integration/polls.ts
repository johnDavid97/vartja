// Local-only fixture test: real editor, browser votes, duplicate protection and privacy.
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { chromium, expect, type Browser } from "@playwright/test";
import { getPayload } from "payload";
import config from "../../payload.config";
import { getPolls } from "../../lib/polls";
import { createAuthenticatedGuest } from "./authenticated-guest";

const baseURL = process.env.TEST_BASE_URL || "http://localhost:3000";
assert(["localhost", "127.0.0.1"].includes(new URL(process.env.DATABASE_URL || "").hostname));
const payload = await getPayload({ config });
let userId: number | undefined;
let postId: number | undefined;
let browser: Browser | undefined;
const guestCleanups: Array<() => Promise<void>> = [];
let code = 0;
try {
  const email = `poll-test-${randomBytes(8).toString("hex")}@example.invalid`;
  const password = randomBytes(24).toString("hex");
  userId = (await payload.create({ collection: "users", data: { email, password, name: "Poll test" } })).id;
  postId = (await payload.create({ collection: "posts", draft: true, data: { title: "Temporary poll test", description: "Introduction" } })).id;
  browser = await chromium.launch();
  const admin = await browser.newContext({ baseURL, viewport: { width: 1440, height: 1200 } });
  assert((await admin.request.post("/api/users/login", { data: { email, password } })).ok());
  const page = await admin.newPage();
  const browserErrors: string[] = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  await page.goto(`/admin/collections/posts/${postId}`);
  const editor = page.locator('.post-visual-editor [contenteditable="true"]');
  await expect(editor).toContainText("Introduction");
  const paragraph = editor.getByText("Introduction", { exact: true });
  const box = await paragraph.boundingBox();
  assert(box);
  await page.getByRole("button", { name: "Legg til avstemning", exact: true }).dragTo(paragraph, { targetPosition: { x: 5, y: box.height - 1 }, steps: 10 });
  const block = page.locator(".post-poll-block");
  await expect(block).toBeVisible();
  await expect(block.getByPlaceholder("Skriv spørsmålet, f.eks. Tar du bussen?")).toBeVisible();
  await expect(block.getByLabel("Spørsmål", { exact: false })).toBeVisible();
  await expect(block.getByLabel("Spørsmål", { exact: true })).toHaveCSS("font-weight", "600");
  await expect(block.getByLabel("Spørsmål", { exact: true })).toHaveCSS("font-size", "16px");
  await block.screenshot({ path: "/tmp/sammen-poll-block.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "Poll editor must fit mobile");
  await block.screenshot({ path: "/tmp/sammen-poll-block-mobile.png" });
  await page.setViewportSize({ width: 1440, height: 1200 });
  await block.locator('input[name="question"]').fill("Hva vil dere spise?");
  const answers = block.locator('input[name^="options."][name$=".label"]');
  await expect(answers).toHaveCount(2);
  await answers.nth(0).fill("Kylling");
  await answers.nth(1).fill("Vegetar");
  await expect(block.getByPlaceholder("Svaralternativ 1")).toHaveValue("Kylling");
  const addAnswer = block.getByRole("button", { name: "Legg til alternativ", exact: true });
  for (let count = 3; count <= 10; count++) {
    await addAnswer.click();
    await expect(answers).toHaveCount(count);
  }
  await expect(addAnswer).toBeDisabled();
  for (let count = 10; count >= 3; count--) {
    await block.getByRole("button", { name: `Fjern svaralternativ ${count}`, exact: true }).click();
    await expect(answers).toHaveCount(count - 1);
  }
  await expect(block.getByRole("button", { name: /^Fjern svaralternativ/ })).toHaveCount(0);
  await expect(answers.nth(0)).toHaveValue("Kylling");
  await expect(answers.nth(1)).toHaveValue("Vegetar");
  const settings = block.locator("summary");
  await settings.click();
  await expect(block.getByRole("checkbox", { name: "Åpen for stemmer", exact: true })).toBeChecked();
  await settings.press("Escape");
  await expect(block.locator("details")).not.toHaveAttribute("open");
  await expect(settings).toBeFocused();
  await page.waitForTimeout(650); // Payload's idle-time form serialization.
  const draftSaved = page.waitForResponse((response) => response.url().includes(`/api/posts/${postId}`) && response.request().method() === "PATCH");
  await page.getByRole("button", { name: "Lagre utkast", exact: true }).click();
  assert((await draftSaved).ok());
  const draft = await payload.findByID({ collection: "posts", id: postId, draft: true });
  const draftPoll = getPolls(draft.body)[0];
  assert(draftPoll, JSON.stringify(draft.body));
  await page.reload();
  await expect(answers.nth(0)).toHaveValue("Kylling");
  await expect(answers.nth(1)).toHaveValue("Vegetar");
  const beforePublication = await browser.newContext({ baseURL });
  guestCleanups.push((await createAuthenticatedGuest({ payload, context: beforePublication, administratorId: userId, baseURL })).cleanup);
  const draftEndpoint = `/api/posts/${postId}/polls/${draftPoll.id}`;
  assert.equal((await beforePublication.request.get(draftEndpoint)).status(), 404);
  assert.equal((await beforePublication.request.post(draftEndpoint, { headers: { Origin: baseURL }, data: { optionId: draftPoll.options[0].id } })).status(), 404);
  await beforePublication.close();
  const saved = page.waitForResponse((response) => response.url().includes(`/api/posts/${postId}`) && response.request().method() === "PATCH");
  await page.getByRole("button", { name: "Publiser endringer", exact: true }).click();
  assert((await saved).ok());
  const post = await payload.findByID({ collection: "posts", id: postId });
  const poll = getPolls(post.body)[0];
  assert(poll, "Poll must be persisted by the editor");
  assert.deepEqual(poll.options.map((option) => option.id), draftPoll.options.map((option) => option.id), "Answer IDs must survive editing, reload and publishing");
  const endpoint = `/api/posts/${postId}/polls/${poll.id}`;
  const anonymous = await browser.newContext({ baseURL });
  assert.equal((await anonymous.request.get(endpoint)).status(), 403);
  assert.equal((await anonymous.request.get(`/api/posts/${postId}`)).status(), 403);
  await anonymous.close();
  const guest = await browser.newContext({ baseURL });
  guestCleanups.push((await createAuthenticatedGuest({ payload, context: guest, administratorId: userId, baseURL })).cleanup);
  const article = await guest.newPage();
  await article.goto(`/news/${postId}`);
  const widget = article.getByRole("region", { name: "Hva vil dere spise?" });
  await widget.getByRole("radio", { name: "Vegetar" }).check();
  await widget.getByRole("button", { name: "Stem", exact: true }).click();
  await expect(widget.getByText("Takk for stemmen!", { exact: true })).toBeVisible();
  await expect(widget.getByText("1 stemme", { exact: true })).toBeVisible();
  await article.reload();
  await expect(widget.getByText("1 stemme", { exact: true })).toBeVisible();

  const sendVote = (context: typeof guest, optionId: string) => context.request.post(endpoint, { headers: { Origin: baseURL }, data: { optionId } });
  const duplicate = await sendVote(guest, poll.options[0].id);
  assert(duplicate.ok());
  assert.equal((await duplicate.json()).selectedOption, poll.options[1].id, "Duplicate attempts must not change the first ballot");
  const second = await browser.newContext({ baseURL });
  guestCleanups.push((await createAuthenticatedGuest({ payload, context: second, administratorId: userId, baseURL })).cleanup);
  assert((await second.request.get(endpoint)).ok()); // Establish one shared browser voting cookie.
  const concurrent = await Promise.all([sendVote(second, poll.options[0].id), sendVote(second, poll.options[0].id)]);
  assert(concurrent.every((response) => response.ok()));
  assert.equal((await (await second.request.get(endpoint)).json()).total, 2, "Concurrent votes count once per browser");
  assert.equal((await sendVote(second, "invalid-answer")).status(), 400);
  assert.equal((await guest.request.post(endpoint, { headers: { Origin: "https://other.example" }, data: { optionId: poll.options[0].id } })).status(), 403);
  assert.equal((await guest.request.get("/api/poll-votes")).status(), 403);
  assert.equal((await guest.request.post("/api/poll-votes", { data: {} })).status(), 403);

  const changed = structuredClone(post.body!);
  const pollNode = changed.root.children.find((node) => node.type === "block")!;
  const fields = pollNode.fields as Record<string, unknown>;
  fields.question = "Changed meaning";
  const edit = await admin.request.patch(`/api/posts/${postId}`, { data: { body: changed, _status: "published" } });
  assert(!edit.ok(), "Questions with votes must not be editable");
  await page.reload();
  await settings.click();
  await block.getByRole("checkbox", { name: "Åpen for stemmer", exact: true }).uncheck();
  await expect(settings).toContainText("Avsluttet");
  await page.waitForTimeout(650);
  const closing = page.waitForResponse((response) => response.url().includes(`/api/posts/${postId}`) && response.request().method() === "PATCH");
  await page.getByRole("button", { name: "Publiser endringer", exact: true }).click();
  assert((await closing).ok());
  assert.equal((await sendVote(second, poll.options[0].id)).status(), 409);
  await article.reload();
  await expect(widget.getByText("Avstemningen er avsluttet.", { exact: true })).toBeVisible();
  await expect(widget.getByText("2 stemmer", { exact: true })).toBeVisible();
  await article.setViewportSize({ width: 390, height: 844 });
  assert(await article.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));

  await payload.update({ collection: "posts", id: postId, data: { visibility: "private", _status: "published" } });
  assert.equal((await guest.request.get(endpoint)).status(), 404);
  assert.equal((await sendVote(guest, poll.options[0].id)).status(), 404);
  await block.getByRole("button", { name: "Fjern avstemning", exact: true }).click();
  await expect(block).toHaveCount(0);
  assert.equal(browserErrors.length, 0, browserErrors.join("\n"));
  console.log("PASS: redesigned poll editor, add/remove limits, stable answer IDs, settings, browser voting/results, cookies, concurrent duplicates, validation, closed/private polls and mobile layout.");
} catch (error) {
  const debugPage = browser?.contexts()[0]?.pages()[0];
  if (debugPage) console.log((await debugPage.locator("body").innerText()).slice(-5000));
  console.error(error);
  code = 1;
} finally {
  if (browser) await browser.close();
  await Promise.all(guestCleanups.map((cleanup) => cleanup()));
  if (postId) {
    await payload.delete({ collection: "posts", id: postId });
    assert.equal((await payload.count({ collection: "poll-votes", where: { post: { equals: postId } } })).totalDocs, 0);
  }
  if (userId) await payload.delete({ collection: "users", id: userId });
  process.exit(code);
}
