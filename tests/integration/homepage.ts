// Real browser/API checks against a freshly-created disposable DB only.
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { chromium, expect, type Browser } from "@playwright/test";
import { getPayload } from "payload";
import sharp from "sharp";
import config from "../../payload.config";
import { createAuthenticatedGuest } from "./authenticated-guest";

const databaseUrl = new URL(process.env.DATABASE_URL || "");
assert(["localhost", "127.0.0.1"].includes(databaseUrl.hostname));
assert(/^\/sammen_homepage_test_\d+_[a-f0-9]+$/.test(databaseUrl.pathname), "Disposable homepage database only");
const baseURL = process.env.TEST_BASE_URL || "http://localhost:3104";
assert(["localhost", "127.0.0.1"].includes(new URL(baseURL).hostname));
const payload = await getPayload({ config });
let browser: Browser | undefined;
let mediaId: number | undefined;
let guestCleanup: (() => Promise<void>) | undefined;
let exitCode = 0;
try {
  const email = `homepage-${randomBytes(6).toString("hex")}@example.invalid`;
  const password = randomBytes(24).toString("hex");
  const administrator = await payload.create({ collection: "users", data: { name: "Homepage test", email, password } });
  await payload.updateGlobal({ slug: "wedding", data: {
    coupleNames: "Andrea & Martin", weddingDate: "2027-07-27T12:00:00Z", venue: "Skottland", welcomeMessage: "",
    heroEyebrow: "Vi gifter oss", heroTitleSuffix: "sitt bryllup", heroBackgroundMode: "color", heroBackgroundColor: "#3c4641",
  } });
  browser = await chromium.launch();
  const guest = await browser.newContext({ baseURL, viewport: { width: 1440, height: 1000 }, locale: "nb-NO", timezoneId: "America/New_York", reducedMotion: "reduce" });
  const page = await guest.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Andrea & Martin");
  await expect(page.getByText("27. juli 2027", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Logg inn for å se innlegg, program og bilder.", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("main").getByRole("link", { name: /^(Logg inn|Se status)$/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Logg inn", exact: true }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Program", exact: true })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Bla i oppdateringer", exact: true })).toHaveCount(0);
  assert.equal((await guest.request.get("/api/posts")).status(), 403);
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Hopp til innhold", exact: true })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();
  await expect(page.getByRole("button", { name: "Neste side", exact: true })).toHaveCount(0);
  assert(!(await guest.request.post("/api/globals/wedding", { data: { heroBackgroundColor: "#ffffff" } })).ok());

  for (let index = 0; index < 7; index += 1) {
    await payload.create({ collection: "posts", data: { title: `Oppdatering ${index + 1}`, description: "Praktisk informasjon til bryllupshelgen. Vi gleder oss til å se dere!", theme: index % 2 ? "Reise" : "Praktisk info", _status: "published", visibility: "public" } });
  }
  await payload.create({ collection: "posts", draft: true, data: { title: "Secret draft fixture", description: "Must never reach the homepage." } });
  await payload.create({ collection: "posts", data: { title: "Secret private fixture", description: "Must never reach the homepage.", _status: "published", visibility: "private" } });
  await page.reload();
  await expect(page.getByRole("region", { name: "Bla i oppdateringer", exact: true })).toHaveCount(0);
  await expect(page.getByText("Oppdatering 1", { exact: true })).toHaveCount(0);
  guestCleanup = (await createAuthenticatedGuest({ payload, context: guest, administratorId: administrator.id, baseURL })).cleanup;
  await page.reload();
  await expect(page.getByRole("link", { name: "Program", exact: true })).toBeVisible();
  const carousel = page.getByRole("region", { name: "Bla i oppdateringer", exact: true });
  await expect(carousel.locator("[data-update-slide]")).toHaveCount(7);
  await expect(page.getByText("Secret draft fixture")).toHaveCount(0);
  await expect(page.getByText("Secret private fixture")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Forrige side", exact: true })).toBeDisabled();
  // A manual one-card scroll stays nearest page one on desktop, but is not at the start.
  const manualOffset = await carousel.evaluate((element) => {
    const slides = element.querySelectorAll<HTMLElement>("[data-update-slide]");
    const offset = slides[1].offsetLeft - slides[0].offsetLeft;
    element.scrollTo({ left: offset, behavior: "instant" });
    return offset;
  });
  await expect.poll(() => carousel.evaluate((element) => element.scrollLeft)).toBeGreaterThan(20);
  await expect.poll(async () => Math.abs(await carousel.evaluate((element) => element.scrollLeft) - manualOffset)).toBeLessThan(3);
  await expect(page.getByRole("button", { name: /^Gå til side 1 av/ })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("button", { name: "Forrige side", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Forrige side", exact: true }).click();
  await expect.poll(() => carousel.evaluate((element) => element.scrollLeft)).toBeLessThan(2);
  await expect(page.getByRole("button", { name: "Forrige side", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Neste side", exact: true }).click();
  await expect.poll(() => carousel.evaluate((element) => element.scrollLeft)).toBeGreaterThan(20);
  await carousel.focus();
  await page.keyboard.press("End");
  await expect(page.getByRole("button", { name: "Neste side", exact: true })).toBeDisabled();
  await page.keyboard.press("Home");
  await expect.poll(() => carousel.evaluate((element) => element.scrollLeft)).toBeLessThan(2);
  await page.getByRole("button", { name: /^Gå til side 2 av/ }).click();
  await expect.poll(() => carousel.evaluate((element) => element.scrollLeft)).toBeGreaterThan(20);

  for (const width of [1440, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: width < 600 ? 844 : 1000 });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const expectedPages = width >= 1024 ? 3 : width >= 640 ? 4 : 7;
    const dots = page.getByRole("group", { name: "Velg side", exact: true }).getByRole("button");
    await expect(dots).toHaveCount(expectedPages);
    await dots.first().click();
    await expect.poll(() => carousel.evaluate((element) => element.scrollLeft)).toBeLessThan(2);
    const visibleCard = await carousel.locator("[data-update-slide]").first().boundingBox();
    const viewport = await carousel.boundingBox();
    assert(visibleCard && viewport && visibleCard.width > 180 && visibleCard.x >= viewport.x - 1 && visibleCard.x + visibleCard.width <= viewport.x + viewport.width + 1, `First card must be fully visible after resize to ${width}px`);
    const heading = await page.getByRole("heading", { level: 1 }).boundingBox();
    assert(heading && heading.x >= 0 && heading.x + heading.width <= width + 1, `Hero title must fit at ${width}px`);
    await page.screenshot({ path: `/tmp/sammen-homepage-${width}.png`, fullPage: true });
    if (width === 390) {
      await page.getByRole("button", { name: "Åpne meny" }).click();
      await expect(page.getByRole("navigation", { name: "Hovedmeny" }).filter({ visible: true }).getByRole("link", { name: "Forside", exact: true })).toHaveAttribute("aria-current", "page");
      await page.keyboard.press("Escape");
      await expect(page.getByRole("button", { name: "Åpne meny" })).toHaveAttribute("aria-expanded", "false");
      await expect(page.getByRole("button", { name: "Åpne meny" })).toBeFocused();
    }
  }

  const admin = await browser.newContext({ baseURL, viewport: { width: 1440, height: 1100 } });
  assert((await admin.request.post("/api/users/login", { data: { email, password } })).ok());
  const adminPage = await admin.newPage();
  adminPage.on("pageerror", (error) => errors.push(error.message));
  await adminPage.goto("/admin/globals/wedding");
  await expect(adminPage.getByRole("radio", { name: "Farge", exact: true })).toBeChecked();
  await expect(adminPage.locator(".field-description-heroBackgroundColor")).toHaveText("Brukes når du velger Farge, og som reserve hvis et bilde mangler.");
  await adminPage.getByRole("textbox", { name: /^Bakgrunnsfarge/ }).fill("#ffffff");
  await adminPage.getByRole("button", { name: "Lagre", exact: true }).click();
  await expect.poll(async () => (await payload.findGlobal({ slug: "wedding" })).heroBackgroundColor).toBe("#ffffff");
  await page.reload();
  const hero = page.locator("main > section").first();
  await expect(hero).toHaveCSS("background-color", "rgb(255, 255, 255)");
  assert.notEqual(await hero.evaluate((element) => getComputedStyle(element).color), "rgb(255, 255, 255)", "Light backgrounds need dark text");
  const invalid = await admin.request.post("/api/globals/wedding", { data: { heroBackgroundColor: "url(https://invalid.example)" } });
  assert.equal(invalid.status(), 400);

  const imageBuffer = await sharp({ create: { width: 1200, height: 800, channels: 3, background: "#728c7d" } }).png().toBuffer();
  const image = await payload.create({ collection: "media", data: { alt: "Testbilde av brudeparet", focalX: 25, focalY: 75 }, file: { data: imageBuffer, name: `homepage-test-${Date.now()}.png`, mimetype: "image/png", size: imageBuffer.length } });
  mediaId = image.id;
  await adminPage.locator('label[for="field-heroBackgroundMode-image"]').click();
  await adminPage.getByRole("button", { name: "Velg fra eksisterende", exact: true }).click();
  const library = adminPage.locator(".list-drawer .admin-table");
  await expect(library).toBeVisible();
  await library.locator(`tr[data-id="${image.id}"] button`).first().click();
  await expect(library).toBeHidden();
  await adminPage.getByRole("button", { name: "Lagre", exact: true }).click();
  await expect.poll(async () => (await payload.findGlobal({ slug: "wedding", depth: 0 })).heroImage).toBe(image.id);
  await adminPage.reload();
  await expect(adminPage.getByRole("radio", { name: "Bilde", exact: true })).toBeChecked();
  await expect(adminPage.getByText("Bilde på forsiden", { exact: true })).toBeVisible();
  await adminPage.screenshot({ path: "/tmp/sammen-homepage-settings.png", fullPage: true });
  await page.reload();
  const heroImage = page.getByRole("img", { name: "Testbilde av brudeparet" });
  await expect(heroImage).toBeVisible();
  const anonymousImageContext = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 } });
  const anonymousImagePage = await anonymousImageContext.newPage();
  await anonymousImagePage.goto("/");
  await expect(anonymousImagePage.getByRole("img", { name: "Testbilde av brudeparet" })).toBeVisible();
  await expect(anonymousImagePage.getByText("Logg inn for å se innlegg, program og bilder.", { exact: true })).toHaveCount(0);
  await expect(anonymousImagePage.getByRole("main").getByRole("link", { name: /^(Logg inn|Se status)$/ })).toHaveCount(0);
  await anonymousImageContext.close();
  await expect(heroImage).toHaveCSS("object-position", "25% 75%");
  await expect.poll(() => heroImage.evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await page.screenshot({ path: "/tmp/sammen-homepage-image-mobile.png", fullPage: true });
  await adminPage.locator('label[for="field-heroBackgroundMode-color"]').click();
  await adminPage.getByRole("button", { name: "Lagre", exact: true }).click();
  await expect.poll(async () => (await payload.findGlobal({ slug: "wedding" })).heroBackgroundMode).toBe("color");
  await page.reload();
  await expect(heroImage).toHaveCount(0);
  assert.equal((await payload.findGlobal({ slug: "wedding", depth: 0 })).heroImage, image.id, "Switching to colour must retain the chosen photo");
  await adminPage.locator('label[for="field-heroBackgroundMode-image"]').click();
  await adminPage.getByRole("button", { name: "Lagre", exact: true }).click();
  await expect.poll(async () => (await payload.findGlobal({ slug: "wedding" })).heroBackgroundMode).toBe("image");
  await adminPage.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => adminPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await adminPage.screenshot({ path: "/tmp/sammen-homepage-settings-mobile.png", fullPage: true });
  assert((await admin.request.post("/api/globals/wedding", { data: { heroImage: null } })).ok());
  await page.reload();
  await expect(page.getByRole("img", { name: "Testbilde av brudeparet" })).toHaveCount(0);
  await expect(hero).toHaveCSS("background-color", "rgb(255, 255, 255)");
  assert.deepEqual(errors, []);
  console.log("PASS: real homepage settings, public-only content, colour/image fallback, focal point, carousel controls, responsive layouts (320–1440), mobile navigation and migration preservation.");
} catch (error) {
  console.error(error);
  exitCode = 1;
} finally {
  await browser?.close();
  await guestCleanup?.();
  if (mediaId) await payload.delete({ collection: "media", id: mediaId });
  await payload.destroy();
}
process.exit(exitCode);
