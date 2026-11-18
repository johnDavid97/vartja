import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { chromium, expect, type Browser } from "@playwright/test";
import { getPayload } from "payload";
import config from "../../payload.config";
import type { PollDefinition } from "../../lib/polls";

const baseURL = process.env.TEST_BASE_URL || "http://localhost:3000";
assert(["localhost", "127.0.0.1"].includes(new URL(process.env.DATABASE_URL || "").hostname));
const payload = await getPayload({ config });
const posts: number[] = [];
let userId: number | undefined;
let browser: Browser | undefined;
let code = 0;
const poll = (id: string, question: string, open = true): PollDefinition => ({ id, question, open, options: [{ id: "yes", label: "Ja" }, { id: "no", label: "Nei" }] });
const body = (...polls: PollDefinition[]) => ({ root: { type: "root", version: 1, format: "" as const, indent: 0, direction: null, children: polls.map((item) => ({ type: "block", version: 2, format: "", fields: { ...item, blockType: "poll" } })) } });
try {
  const email = `poll-overview-${randomBytes(8).toString("hex")}@example.invalid`;
  const password = randomBytes(24).toString("hex");
  userId = (await payload.create({ collection: "users", data: { email, password, name: "Poll overview test" } })).id;
  browser = await chromium.launch();
  const admin = await browser.newContext({ baseURL, viewport: { width: 1440, height: 1000 } });
  assert((await admin.request.post("/api/users/login", { data: { email, password } })).ok());
  const guest = await browser.newContext({ baseURL });
  const page = await admin.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/admin/polls");
  await expect(page.getByRole("heading", { name: "Ingen avstemninger ennå" })).toBeVisible();

  const livePoll = poll("live", "Tar du bussen?");
  const closedPoll = poll("closed", "Vil du ha kaffe?", false);
  const archivedPoll = poll("archive", "Tidligere spørsmål?");
  const live = await payload.create({ collection: "posts", data: { title: "Transport og praktisk", description: "Test", visibility: "public", _status: "published", body: body(livePoll, closedPoll, archivedPoll) } });
  posts.push(live.id);
  const privatePoll = poll("live", "Hemmelig spørsmål?");
  const privatePost = await payload.create({ collection: "posts", data: { title: "Privat planlegging", description: "Test", visibility: "private", _status: "published", body: body(privatePoll) } });
  posts.push(privatePost.id);
  const draft = await payload.create({ collection: "posts", draft: true, data: { title: "Utkast til mat", description: "Test", body: body(poll("draft", "Hva vil du spise?")) } });
  posts.push(draft.id);
  for (const [post, definition, optionId] of [[live.id, livePoll, "yes"], [live.id, livePoll, "yes"], [live.id, livePoll, "no"], [live.id, archivedPoll, "yes"], [privatePost.id, privatePoll, "no"]] as const) {
    await payload.create({ collection: "poll-votes", overrideAccess: true, data: { post, pollId: definition.id, optionId, definition, voteKey: randomBytes(32).toString("hex") } });
  }
  await payload.update({ collection: "posts", id: live.id, data: { body: body(livePoll, closedPoll), _status: "published" } });
  await payload.update({ collection: "posts", id: live.id, draft: true, data: { body: body({ ...livePoll, open: false }, closedPoll), _status: "draft" } });
  const before = await payload.count({ collection: "poll-votes", overrideAccess: true });
  await page.reload();
  await expect(page.locator("tbody tr")).toHaveCount(5);
  const liveRow = page.locator("tbody tr").filter({ hasText: "Tar du bussen?" });
  await expect(liveRow).toContainText("Åpen");
  await expect(liveRow).toContainText("Endringer i utkast");
  await expect(liveRow.locator("td").last()).toHaveText("3");
  await expect(page.locator("tbody tr").filter({ hasText: "Tidligere spørsmål?" })).toContainText("Arkivert");
  await expect(page.locator("tbody tr").filter({ hasText: "Hva vil du spise?" })).toContainText("Utkast");
  await expect(page.locator("tbody tr").filter({ hasText: "Hemmelig spørsmål?" })).toContainText("Privat · bare redaktører");
  await page.getByLabel("Søk i avstemninger").fill("TRANSPORT");
  await expect(page.locator("tbody tr")).toHaveCount(3);
  await page.getByLabel("Status", { exact: true }).selectOption("closed");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await page.getByLabel("Søk i avstemninger").fill("Ingen treff xyz");
  await expect(page.getByRole("heading", { name: "Ingen treff" })).toBeVisible();
  await page.getByLabel("Søk i avstemninger").fill("");
  await page.getByLabel("Status", { exact: true }).selectOption("all");

  const resultsButton = page.getByRole("button", { name: "Tar du bussen?", exact: true });
  await resultsButton.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("3 stemmer · Åpen");
  await expect(dialog).toContainText("2 stemmer · 67 %");
  await expect(dialog).toContainText("1 stemmer · 33 %");
  await expect(dialog.getByRole("link", { name: "Rediger i innlegget" })).toHaveAttribute("href", `/admin/collections/posts/${live.id}`);
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(resultsButton).toBeFocused();
  for (const width of [1440, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Overview fits ${width}px`);
    await page.screenshot({ path: `/tmp/sammen-poll-overview-${width}.png`, fullPage: true });
    await resultsButton.click();
    const bounds = await dialog.boundingBox();
    assert(bounds && bounds.x >= 0 && bounds.x + bounds.width <= width, `Results fit ${width}px`);
    await expect(dialog.getByRole("button", { name: "Lukk resultater" })).toBeInViewport();
    await page.screenshot({ path: `/tmp/sammen-poll-results-${width}.png`, fullPage: true });
    await page.keyboard.press("Escape");
  }
  const many = await payload.create({ collection: "posts", draft: true, data: { title: "Z flere spørsmål", description: "Test", body: body(...Array.from({ length: 21 }, (_, index) => poll(`more-${index}`, `Ekstra spørsmål ${index + 1}?`))) } });
  posts.push(many.id);
  await page.getByRole("button", { name: "Oppdater", exact: true }).click();
  await expect(page.locator("tbody tr")).toHaveCount(20);
  await page.getByRole("button", { name: "Neste", exact: true }).click();
  await expect(page.locator("tbody tr")).toHaveCount(6);
  await page.getByLabel("Søk i avstemninger").fill("bussen");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Forrige", exact: true })).toBeDisabled();
  const anonymous = await guest.request.get("/admin/polls", { maxRedirects: 0 });
  // Next can encode redirects in a streamed 200 response; verify navigation as well as no data leakage.
  const anonymousBody = await anonymous.text();
  assert(!anonymousBody.includes("Hemmelig spørsmål"));
  assert(!anonymousBody.includes("Tar du bussen?"));
  const guestPage = await guest.newPage();
  await guestPage.goto("/admin/polls");
  await expect(guestPage).toHaveURL(/\/admin\/login/);
  assert.equal((await guest.request.get("/api/poll-votes")).status(), 403);
  assert.equal((await guest.request.get(`/api/posts/${privatePost.id}/polls/live`)).status(), 404);
  assert.equal((await guest.request.get(`/api/posts/${draft.id}/polls/draft`)).status(), 404);
  const publicResults = await (await guest.request.get(`/api/posts/${live.id}/polls/live`)).json();
  assert.equal(publicResults.total, 3);
  assert.equal(publicResults.open, true);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await resultsButton.click();
  await dialog.getByRole("link", { name: "Rediger i innlegget" }).click();
  await expect(page).toHaveURL(new RegExp(`/admin/collections/posts/${live.id}$`));
  await expect(page.locator(".post-poll-block")).toHaveCount(2);
  assert.equal((await payload.count({ collection: "poll-votes", overrideAccess: true })).totalDocs, before.totalDocs);
  assert.deepEqual(errors, []);
  console.log("PASS: poll overview, live/draft separation, private/archived results, counts, search/filter, keyboard dialog, editor links, guest denial and responsive layouts.");
} catch (error) {
  console.error(error); code = 1;
} finally {
  await browser?.close();
  for (const id of posts) await payload.delete({ collection: "posts", id }).catch(() => undefined);
  if (userId) await payload.delete({ collection: "users", id: userId }).catch(() => undefined);
  await payload.destroy();
  process.exit(code);
}
