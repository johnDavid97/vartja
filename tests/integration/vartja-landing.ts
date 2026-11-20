import assert from "node:assert/strict";
import { chromium, expect, type Browser, type Page } from "@playwright/test";
import { HOUSEHOLD_SESSION_COOKIE } from "../../features/households/http/session-cookie";

const databaseUrl = new URL(process.env.DATABASE_URL || "");
assert(["localhost", "127.0.0.1"].includes(databaseUrl.hostname), "Local databases only");
assert(
  /^\/sammen_wedding_routing_test_\d+_[a-f0-9]+$/.test(databaseUrl.pathname),
  "VårtJa landing tests require the routing runner's explicitly guarded disposable database",
);
const baseURL = process.env.TEST_BASE_URL || "http://localhost:3114";
const origin = new URL(baseURL);
assert.equal(origin.port, "3114", "VårtJa landing tests require the routing runner's dedicated port");
assert(["localhost", "127.0.0.1"].includes(origin.hostname), "Local test server only");

interface LandingSnapshot {
  title: string;
  language: string;
  heading: string;
  text: string;
  links: string[];
}

function normalizedText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

async function landingSnapshot(page: Page): Promise<LandingSnapshot> {
  return {
    title: await page.title(),
    language: await page.locator("html").getAttribute("lang") || "",
    heading: normalizedText(await page.getByRole("heading", { level: 1 }).innerText()),
    text: normalizedText(await page.locator("body").innerText()),
    links: await page.locator("a").evaluateAll((links) => links.map((link) => link.getAttribute("href") || "")),
  };
}

async function expectNoHorizontalOverflow(page: Page, width: number): Promise<void> {
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const body = await page.locator("body").boundingBox();
  assert(body && body.x >= -1 && body.x + body.width <= width + 1, `Landing page must fit at ${width}px`);
}

let browser: Browser | undefined;
let exitCode = 0;

try {
  browser = await chromium.launch();
  const anonymous = await browser.newContext({
    baseURL,
    viewport: { width: 1440, height: 1000 },
    locale: "nb-NO",
    reducedMotion: "reduce",
  });
  const page = await anonymous.newPage();
  const apiRequests: string[] = [];
  const pageErrors: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.origin === origin.origin && (url.pathname === "/api" || url.pathname.startsWith("/api/"))) {
      apiRequests.push(`${request.method()} ${url.pathname}`);
    }
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));

  const directResponse = await anonymous.request.get("/", { maxRedirects: 0 });
  assert.equal(directResponse.status(), 200, "The marketing root must respond directly with HTTP 200");
  assert.equal(directResponse.headers().location, undefined, "The marketing root must not redirect");

  const navigationResponse = await page.goto("/");
  assert.equal(navigationResponse?.status(), 200);
  assert.equal(page.url(), `${origin.origin}/`);
  await expect(page).toHaveTitle("VårtJa · Personlige bryllupsnettsider");
  await expect(page.locator("html")).toHaveAttribute("lang", "nb");
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Et stort ja\.\s*Et helt eget sted\./);
  await expect(page.getByRole("heading", { name: /Alt det viktige/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: /En del av feiringen/ })).toBeVisible();
  await expect(page.getByText("PERSONLIGE BRYLLUPSNETTSIDER", { exact: true })).toBeVisible();

  const icon = page.locator('link[rel="icon"]');
  await expect(icon).toHaveCount(1);
  await expect(icon).toHaveAttribute("href", "/vartja-icon.svg");
  await expect(icon).toHaveAttribute("type", "image/svg+xml");
  const iconResponse = await page.request.get((await icon.getAttribute("href"))!);
  assert.equal(iconResponse.status(), 200);
  assert.match(iconResponse.headers()["content-type"], /image\/svg\+xml/);
  assert((await iconResponse.text()).includes(">VJ</text>"), "The marketing root must use the distinct VJ icon");

  const sample = page.locator("figure");
  await expect(sample).toHaveCount(1);
  await expect(sample.locator("figcaption")).toHaveText("En liten illustrasjon av den store dagen.");
  await expect(sample.locator('[aria-hidden="true"]').first()).toContainText(/Deres\s*store dag\./);

  const bodyText = await page.locator("body").innerText();
  assert(!/\b(?:Andrea|Martin)\b/i.test(bodyText), "The generic landing page must not expose the private couple names");
  assert(!/\b(?:demo|kontakt|priser?|prisplan|abonnement)\b/i.test(bodyText), "No demo, contact or pricing offer has been agreed");
  assert(!/(?:godta alle|avvis alle|samtykke|informasjonskapsler)/i.test(bodyText), "The static page must not show fake consent controls");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator("form")).toHaveCount(0);

  const hrefs = await page.locator("a").evaluateAll((links) => links.map((link) => link.getAttribute("href") || ""));
  for (const href of hrefs) {
    const target = new URL(href, origin);
    assert(!target.pathname.startsWith("/andrea-og-martin"), `Landing link must not enter the wedding site: ${href}`);
    assert(!target.pathname.startsWith("/admin"), `Landing link must not enter administration: ${href}`);
    assert(!target.pathname.startsWith("/api"), `Landing link must not enter an API: ${href}`);
    if (href.startsWith("#")) {
      assert.equal(await page.locator(href).count(), 1, `Section link ${href} must resolve to one target`);
    }
  }

  for (const [linkName, hash, headingName] of [
    ["Dette får dere", "#muligheter", /Alt det viktige/],
    ["For gjestene", "#gjestene", /En del av feiringen/],
  ] as const) {
    await page.getByRole("navigation", { name: "Hovedmeny" }).getByRole("link", { name: linkName }).click();
    await expect(page).toHaveURL(`${origin.origin}/${hash}`);
    await expect(page.getByRole("heading", { name: headingName })).toBeInViewport();
  }

  await page.getByRole("link", { name: "Se mulighetene" }).click();
  await expect(page).toHaveURL(`${origin.origin}/#muligheter`);
  await expect(page.locator("#muligheter")).toBeInViewport();
  await page.getByRole("link", { name: "Til toppen" }).click();
  await expect(page).toHaveURL(`${origin.origin}/#toppen`);
  await expect(page.locator("#toppen")).toBeInViewport();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);

  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto("/");
  await page.keyboard.press("Tab");
  const skipLink = page.getByRole("link", { name: "Hopp til innhold", exact: true });
  await expect(skipLink).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#hovedinnhold")).toBeFocused();

  await page.goto("/");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "VårtJa – forsiden", exact: true })).toBeFocused();
  await page.keyboard.press("Tab");
  const mobileSectionLink = page.getByRole("navigation", { name: "Hovedmeny" }).getByRole("link", { name: "Dette får dere" });
  await expect(mobileSectionLink).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(`${origin.origin}/#muligheter`);
  await expect(page.locator("#muligheter")).toBeInViewport();
  // An anchor moves the sequential focus starting point to its destination.
  // Start again to exercise the second navigation link, not the section's next control.
  await page.goto("/");
  for (let tab = 0; tab < 4; tab += 1) await page.keyboard.press("Tab");
  const mobileGuestLink = page.getByRole("navigation", { name: "Hovedmeny" }).getByRole("link", { name: "For gjestene" });
  await expect(mobileGuestLink).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(`${origin.origin}/#gjestene`);
  await expect(page.locator("#gjestene")).toBeInViewport();

  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: width < 600 ? 844 : 1000 });
    await page.goto("/");
    await expect(page.getByRole("navigation", { name: "Hovedmeny" })).toBeVisible();
    await expectNoHorizontalOverflow(page, width);
    await page.screenshot({ path: `/tmp/sammen-vartja-landing-${width}.png`, fullPage: true });
  }
  const anonymousSnapshot = await landingSnapshot(page);

  const withSession = await browser.newContext({
    baseURL,
    viewport: { width: 1440, height: 1000 },
    locale: "nb-NO",
    reducedMotion: "reduce",
  });
  await withSession.addCookies([{
    name: HOUSEHOLD_SESSION_COOKIE,
    value: "A".repeat(43),
    url: origin.origin,
    httpOnly: true,
    sameSite: "Lax",
  }]);
  const sessionPage = await withSession.newPage();
  const sessionApiRequests: string[] = [];
  sessionPage.on("request", (request) => {
    const url = new URL(request.url());
    if (url.origin === origin.origin && (url.pathname === "/api" || url.pathname.startsWith("/api/"))) {
      sessionApiRequests.push(`${request.method()} ${url.pathname}`);
    }
  });
  const sessionResponse = await sessionPage.goto("/");
  assert.equal(sessionResponse?.status(), 200);
  assert.equal(sessionPage.url(), `${origin.origin}/`);
  assert.deepEqual(await landingSnapshot(sessionPage), anonymousSnapshot, "An invalid session cookie must not personalize the static marketing root");
  assert.deepEqual(sessionApiRequests, [], "The marketing root must not make authentication or other API requests");
  await withSession.close();

  const withoutJavaScript = await browser.newContext({ baseURL, javaScriptEnabled: false });
  const staticPage = await withoutJavaScript.newPage();
  await staticPage.goto("/");
  await expect(staticPage).toHaveTitle("VårtJa · Personlige bryllupsnettsider");
  await staticPage.getByRole("link", { name: "Se mulighetene" }).click();
  await expect(staticPage.locator("#muligheter")).toBeInViewport();
  await withoutJavaScript.close();

  assert.deepEqual(apiRequests, [], "The marketing root must not request CMS, authentication or other APIs");
  assert.deepEqual(pageErrors, []);
  console.log("PASS: static VårtJa root metadata/icon, generic Norwegian content, labelled sample, safe links, keyboard anchors, invalid-cookie independence and responsive 320–1440 layouts.");
} catch (error) {
  console.error(error);
  exitCode = 1;
} finally {
  await browser?.close();
}
process.exit(exitCode);
