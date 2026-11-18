import { expect, test, type Page } from "@playwright/test";

const browserErrors = new WeakMap<Page, string[]>();
test.beforeEach(({ page }) => {
  const errors: string[] = [];
  browserErrors.set(page, errors);
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().startsWith("Failed to load resource: the server responded with a status of 404")) {
      errors.push(message.text());
    }
  });
});
test.afterEach(async ({ page }) => {
  await page.waitForLoadState("networkidle");
  expect(browserErrors.get(page), "No React or browser-console errors").toEqual([]);
});

// Read-only anonymous smoke checks against a running development server.
test("anonymous homepage shows only the hero and public login navigation", async ({ page }, testInfo) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByText("Logg inn for å se innlegg, program og bilder.", { exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Bla i oppdateringer", exact: true })).toHaveCount(0);
  await expect(page.getByText("Det er ingen oppdateringer ennå.", { exact: true })).toHaveCount(0);

  const visibleNavigation = page.getByRole("navigation", { name: "Hovedmeny" }).filter({ visible: true });
  if (testInfo.project.name === "mobile") {
    await page.getByRole("button", { name: "Åpne meny", exact: true }).click();
  }
  await expect(visibleNavigation.getByRole("link", { name: "Logg inn", exact: true })).toBeVisible();
  for (const label of ["Program", "Innlegg", "Bilder", "Reiseplan", "Ting å gjøre", "Brudefølge"]) {
    await expect(visibleNavigation.getByRole("link", { name: label, exact: true })).toHaveCount(0);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("skip link focuses the anonymous homepage content", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  const skipLink = page.getByRole("link", { name: "Hopp til innhold", exact: true });
  await expect(skipLink).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();
});

test("protected wedding pages redirect anonymous visitors to household login", async ({ page }) => {
  for (const route of ["/news", "/news/not-a-valid-id", "/program", "/bilder"]) {
    await page.goto(route);
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { name: "Velkommen tilbake", level: 1 })).toBeVisible();
  }
});

test("removed wedding pages return not found", async ({ request }) => {
  for (const route of ["/reiseplan", "/ting-a-gjore", "/wedding-party"]) {
    expect((await request.get(route)).status()).toBe(404);
  }
});

test("household login form is responsive and exposes its accessible controls", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByLabel("Husstandsnavn", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Husstandskode", { exact: true })).toHaveAttribute("type", "password");
  await expect(page.getByRole("checkbox", { name: "Husk meg på denne enheten", exact: true })).toBeChecked();
  await expect(page.getByRole("button", { name: "Logg inn", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Vis kode", exact: true }).click();
  await expect(page.getByLabel("Husstandskode", { exact: true })).toHaveAttribute("type", "text");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("admin login renders without prerender errors", async ({ page }) => {
  await page.goto("/admin/login");
  await expect(page.locator('input[name="email"]')).toBeVisible();
});

test("anonymous visitors cannot read or create posts", async ({ request }) => {
  expect((await request.get("/api/posts?limit=1")).status()).toBe(403);
  expect((await request.post("/api/posts", { data: {} })).status()).toBe(403);
});
