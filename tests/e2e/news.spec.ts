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

// Read-only smoke checks against a running development server.
test("news page renders without horizontal overflow", async ({ page }) => {
  await page.goto("/news");
  await expect(page.getByRole("heading", { name: "Nytt fra oss", level: 1 })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("a published article opens and remains responsive", async ({ page, request }) => {
  const response = await request.get("/api/posts?limit=1");
  expect(response.ok()).toBe(true);
  const { docs } = await response.json();
  test.skip(!docs.length, "No published posts exist in this database.");
  const post = docs[0];
  await page.goto(`/news/${post.id}`);
  await expect(page.getByRole("heading", { name: post.title, level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: "← Alle innlegg" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("unknown articles show the not-found page", async ({ page }) => {
  await page.goto("/news/not-a-valid-id");
  await expect(page.getByRole("heading", { name: "Fant ikke innlegget" })).toBeVisible();
});

test("empty pagination offers a working link back", async ({ page }) => {
  await page.goto("/news?page=999999");
  const back = page.getByRole("link", { name: "Til første side" });
  await expect(back).toBeVisible();
  await back.click();
  await expect(page).toHaveURL(/\/news$/);
});

test("admin login renders without prerender errors", async ({ page }) => {
  await page.goto("/admin/login");
  await expect(page.locator('input[name="email"]')).toBeVisible();
});

test("anonymous visitors cannot create posts", async ({ request }) => {
  const response = await request.post("/api/posts", { data: {} });
  expect(response.status()).toBe(403);
});
