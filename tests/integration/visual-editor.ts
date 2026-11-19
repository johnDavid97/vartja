// Run only against local development. Creates and removes its own fixtures.
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { chromium, expect, type Browser } from "@playwright/test";
import { getPayload } from "payload";
import sharp from "sharp";
import config from "../../payload.config";
import { createAuthenticatedGuest } from "./authenticated-guest";

const baseURL = process.env.TEST_BASE_URL || "http://localhost:3000";
const databaseHost = new URL(process.env.DATABASE_URL || "").hostname;
assert(["localhost", "127.0.0.1"].includes(databaseHost), "Editor integration tests require a local database.");
const payload = await getPayload({ config });
let userId: number | undefined;
let postId: number | undefined;
let mediaId: number | undefined;
let uploadedMediaId: number | undefined;
let browser: Browser | undefined;
const guestCleanups: Array<() => Promise<void>> = [];
let exitCode = 0;

try {
  const email = `editor-test-${randomBytes(8).toString("hex")}@example.invalid`;
  const password = randomBytes(24).toString("hex");
  const user = await payload.create({ collection: "users", data: { name: "Temporary editor test", email, password } });
  userId = user.id;
  const imageData = await sharp({ create: { width: 40, height: 30, channels: 3, background: "#e6c9cc" } }).png().toBuffer();
  const image = await payload.create({
    collection: "media", data: { alt: "Temporary editor photo" },
    file: { name: `editor-test-${Date.now()}.png`, mimetype: "image/png", data: imageData, size: imageData.length },
  });
  mediaId = image.id;
  const post = await payload.create({
    collection: "posts", draft: true,
    data: {
      title: "Temporary visual editor test", description: "Card excerpt",
      content: [
        { blockType: "text", heading: "Original heading", text: "Original paragraph" },
        { blockType: "text", text: "Final paragraph" },
        { blockType: "image", image: image.id, caption: "Original photo caption" },
      ],
    },
  });
  postId = post.id;
  browser = await chromium.launch();
  const context = await browser.newContext({ baseURL, viewport: { width: 1440, height: 1200 } });
  const login = await context.request.post("/api/users/login", { data: { email, password } });
  assert(login.ok(), "Temporary editor must be able to sign in");
  const page = await context.newPage();
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") pageErrors.push(message.text());
  });
  await page.goto(`/admin/collections/posts/${postId}`);
  const editor = page.locator('.post-visual-editor [contenteditable="true"]');
  await expect(editor).toContainText("Original paragraph");
  await expect(editor).toContainText("Final paragraph");
  await expect(editor.locator(`img[src*="${image.filename}"]`)).toBeVisible();
  await expect(page.locator(".post-editor-insert-line")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Legg til overskrift", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Legg til tekst", exact: true })).toHaveCount(0);
  for (const name of ["add dropdown", "blocks dropdown", "inlineBlocks dropdown"]) {
    await expect(page.getByRole("button", { name, exact: true })).toHaveCount(0);
  }
  await expect(page.getByRole("button", { name: "Add block", exact: true })).toHaveCount(0);
  await editor.getByText("Original paragraph", { exact: true }).click();
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  await page.keyboard.type("/");
  await expect(editor).toContainText("/");
  await page.waitForTimeout(250); // Give the old slash popup time to appear, if reintroduced.
  await expect(page.locator(".slash-menu-popup")).toHaveCount(0);
  await page.keyboard.press("Backspace");
  await page.keyboard.press("Backspace");
  const dividerTarget = editor.getByText("Final paragraph", { exact: true });
  const dividerBox = await dividerTarget.boundingBox();
  assert(dividerBox);
  await page.getByRole("button", { name: "Legg til skillelinje", exact: true }).dragTo(dividerTarget, {
    targetPosition: { x: 20, y: dividerBox.height - 2 }, steps: 10,
  });
  await expect(editor.locator("hr")).toHaveCount(1);
  const originalHeading = editor.getByRole("heading", { name: "Original heading", exact: true });
  await originalHeading.locator('[data-lexical-text="true"]').first().click({ clickCount: 3 });
  assert.equal(await page.evaluate(() => window.getSelection()?.toString().trim()), "Original heading");
  await page.getByRole("button", { name: "textState dropdown", exact: true }).first().click();
  await page.getByRole("button", { name: "Stor", exact: true }).filter({ visible: true }).last().click();
  const addedHeading = originalHeading;
  const addedBox = await originalHeading.boundingBox();
  assert(addedBox);
  await page.getByRole("button", { name: "Legg til bilde", exact: true }).dragTo(addedHeading, {
    targetPosition: { x: 20, y: addedBox.height - 2 }, steps: 10,
  });
  const placeholder = editor.getByRole("button", { name: "Velg bilde fra datamaskinen", exact: true });
  await expect(placeholder).toBeVisible();
  const invalidChooserPromise = page.waitForEvent("filechooser");
  await placeholder.click();
  await (await invalidChooserPromise).setFiles({ name: "not-an-image.txt", mimeType: "text/plain", buffer: Buffer.from("invalid") });
  await expect(editor.getByRole("alert")).toHaveText("Velg et JPG-, PNG- eller WebP-bilde.");
  const chooserPromise = page.waitForEvent("filechooser");
  await placeholder.click();
  const chooser = await chooserPromise;
  const uploadResponse = page.waitForResponse((response) => response.url().endsWith("/api/media") && response.request().method() === "POST");
  await chooser.setFiles({ name: `dropped-${Date.now()}.png`, mimeType: "image/png", buffer: imageData });
  const uploaded = await uploadResponse;
  assert(uploaded.ok(), "Direct file upload should succeed");
  uploadedMediaId = (await uploaded.json()).doc.id;
  await expect(editor.getByRole("button", { name: "Bytt bilde", exact: true })).toBeVisible();
  const settings = editor.locator('summary[aria-label="Bildeinnstillinger"]');
  await expect(editor.getByLabel("Bildetekst (valgfritt)", { exact: true })).toBeHidden();
  const mediaHeight = (await editor.locator(".post-photo-block__media").boundingBox())?.height;
  await settings.click();
  await editor.getByLabel("Beskrivelse for skjermleser", { exact: true }).fill("New dropped photo");
  await editor.getByLabel("Bildetekst (valgfritt)", { exact: true }).fill("New photo caption");
  assert.equal((await editor.locator(".post-photo-block__media").boundingBox())?.height, mediaHeight, "Settings must not expand the photo block");
  await page.keyboard.press("Escape");
  await expect(editor.getByLabel("Bildetekst (valgfritt)", { exact: true })).toBeHidden();
  await settings.click();
  await expect(editor.getByLabel("Bildetekst (valgfritt)", { exact: true })).toHaveValue("New photo caption");
  await settings.click();
  // Payload serializes rich-text form state during browser idle time (up to 500 ms).
  await page.waitForTimeout(650);
  const anonymous = await browser.newContext({ baseURL });
  assert.equal((await anonymous.request.get(`/api/posts/${postId}`)).status(), 403, "Anonymous post reads must be denied");
  const anonymousPage = await anonymous.newPage();
  await anonymousPage.goto(`/news/${postId}`);
  await expect(anonymousPage).toHaveURL(/\/login$/);
  await anonymous.close();
  const beforePublication = await browser.newContext({ baseURL });
  guestCleanups.push((await createAuthenticatedGuest({ payload, context: beforePublication, administratorId: user.id, baseURL })).cleanup);
  assert.equal((await beforePublication.request.get(`/api/posts/${postId}`)).status(), 404, "Drafts must remain private from approved households");
  await beforePublication.close();
  const save = page.waitForResponse((response) => response.url().includes(`/api/posts/${postId}`) && response.request().method() === "PATCH");
  await page.getByRole("button", { name: "Publiser endringer", exact: true }).click();
  const saved = await save;
  assert(saved.ok(), "Editor changes must save successfully");
  const guest = await browser.newContext({ baseURL });
  guestCleanups.push((await createAuthenticatedGuest({ payload, context: guest, administratorId: user.id, baseURL })).cleanup);
  const article = await guest.newPage();
  await article.goto(`/news/${postId}`);
  await expect(article.getByRole("heading", { name: "Original heading" })).toBeVisible();
  // Comments have their own heading; assert only the saved rich-text body.
  const headings = await article.locator("article > header + div h2").allTextContents();
  assert.deepEqual(headings, ["Original heading"]);
  await expect(article.getByRole("heading", { name: "Original heading" }).locator('span[style*="font-size"]')).toHaveCSS("font-size", "22px");
  await expect(article.getByRole("img", { name: "Temporary editor photo" })).toBeVisible();
  await expect(article.getByRole("img", { name: "New dropped photo" })).toBeVisible();
  await expect(article.getByText("New photo caption", { exact: true })).toBeVisible();
  await expect(article.getByText("Original photo caption", { exact: true })).toBeVisible();
  await expect(article.locator("article hr")).toHaveCount(1);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("button", { name: "Legg til bilde", exact: true })).toBeVisible();
  await settings.click();
  await expect(editor.getByLabel("Bildetekst (valgfritt)", { exact: true })).toBeVisible();
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "Editor and photo settings should fit a mobile screen");
  await settings.click();
  await page.getByRole("button", { name: "Legg til skillelinje", exact: true }).click();
  await expect(editor.locator("hr")).toHaveCount(2);
  const makePrivate = await context.request.patch(`/api/posts/${postId}`, {
    data: { visibility: "private", _status: "published" },
  });
  assert(makePrivate.ok(), "Visibility update must save");
  assert.equal((await guest.request.get(`/api/posts/${postId}`)).status(), 404, "Private posts must not be readable by approved households");
  assert((await context.request.get(`/api/posts/${postId}`)).ok(), "Editors can still read private posts");
  const publicList = await guest.request.get(`/api/posts?where[id][equals]=${postId}`);
  assert.equal((await publicList.json()).docs.length, 0, "Private posts must be excluded from public listings");
  await article.reload();
  await expect(article.getByRole("heading", { name: "Fant ikke innlegget" })).toBeVisible();
  assert.equal(pageErrors.length, 0, pageErrors.join("\n"));
  console.log("PASS: sidebar-only insertion, divider/photo drag-and-drop, direct upload, formatting, publishing, privacy and mobile insertion/layout.");
} catch (error) {
  console.error(error);
  exitCode = 1;
} finally {
  if (browser) await browser.close();
  await Promise.all(guestCleanups.map((cleanup) => cleanup()));
  if (postId) await payload.delete({ collection: "posts", id: postId });
  if (uploadedMediaId) await payload.delete({ collection: "media", id: uploadedMediaId });
  if (mediaId) await payload.delete({ collection: "media", id: mediaId });
  if (userId) await payload.delete({ collection: "users", id: userId });
  // Payload's development connection watcher otherwise keeps this one-shot script alive.
  process.exit(exitCode);
}
