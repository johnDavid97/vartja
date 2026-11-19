// This suite owns only disposable fixtures; never run it against the real wedding database.
import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { chromium, expect, type Browser, type BrowserContext, type Locator, type Page } from "@playwright/test";
import { getPayload } from "payload";
import config from "../../payload.config";
import { getHouseholdAdminServices, getHouseholdRegistrationServices } from "../../features/households/composition-root";

const databaseUrl = new URL(process.env.DATABASE_URL || "");
assert(["localhost", "127.0.0.1"].includes(databaseUrl.hostname), "Local databases only");
assert(
  /^\/sammen_admin_dashboard_test_\d+_[a-f0-9]+$/.test(databaseUrl.pathname),
  "Disposable admin-dashboard database only",
);
const baseURL = process.env.TEST_BASE_URL || "http://localhost:3112";
assert(["localhost", "127.0.0.1"].includes(new URL(baseURL).hostname), "Local test server only");

const payload = await getPayload({ config });
const householdIds: number[] = [];
const postIds: number[] = [];
let userId: number | undefined;
let browser: Browser | undefined;
let exitCode = 0;

const dashboardCards = [
  ["Husstander", "Registrert totalt", "totalHouseholds"],
  ["Til godkjenning", "Husstander som venter", "pendingHouseholds"],
  ["Innlegg", "Synlige for godkjente gjester", "visiblePosts"],
] as const;

type DashboardCounts = {
  totalHouseholds: number;
  pendingHouseholds: number;
  visiblePosts: number;
};

function registrationData(label: string, additionalMembers: string[] = []) {
  const key = randomUUID();
  return {
    requestKey: key,
    contactName: `${label} kontakt`,
    displayName: `${label} ${key.slice(0, 8)}`,
    email: `dashboard-household-${key}@example.invalid`,
    additionalMembers: additionalMembers.map((name) => ({ name })),
  };
}

async function domainFingerprint(): Promise<string> {
  const [households, posts, postVersions] = await Promise.all([
    payload.find({
      collection: "households", overrideAccess: true, showHiddenFields: true,
      pagination: false, depth: 0, sort: "id",
    }),
    payload.find({
      collection: "posts", overrideAccess: true, draft: true,
      pagination: false, depth: 0, sort: "id",
      context: { skipLegacyBodyConversion: true },
    }),
    payload.findVersions({
      collection: "posts", overrideAccess: true,
      pagination: false, depth: 0, sort: "id",
      context: { skipLegacyBodyConversion: true },
    }),
  ]);
  // Deliberately exclude sessions, preferences, request limits and audit bookkeeping.
  return createHash("sha256")
    .update(JSON.stringify({ households: households.docs, posts: posts.docs, postVersions: postVersions.docs }))
    .digest("hex");
}

function dashboardSection(page: Page): Locator {
  return page.getByRole("heading", { level: 1, name: "Velkommen", exact: true }).locator("xpath=ancestor::section[1]");
}

async function expectDashboard(page: Page, counts: DashboardCounts): Promise<void> {
  await expect(page).toHaveURL(/\/admin\/?(?:\?|$)/);
  const section = dashboardSection(page);
  await expect(section).toBeVisible();
  await expect(section.getByText("Her får dere oversikt over husstander og innlegg.", { exact: true })).toBeVisible();
  await expect(section.locator("dl > div")).toHaveCount(3);

  for (const [label, description, key] of dashboardCards) {
    const card = section.locator("dl > div").filter({ has: page.locator("dt", { hasText: label }) });
    await expect(card).toHaveCount(1);
    await expect(card.locator("dt")).toHaveText(label);
    await expect(card.locator("dd").first()).toHaveText(String(counts[key]));
    await expect(card.locator("dd").nth(1)).toHaveText(description);
    await expect(card.locator("a, button, [role='link']")).toHaveCount(0);
  }

  await expect(section.locator("a, button, [role='link']")).toHaveCount(0);
  for (const oldLabel of ["Skriv et innlegg", "Endre bryllupsinformasjon", "Se nettsiden ↗"]) {
    await expect(section.getByText(oldLabel, { exact: true })).toHaveCount(0);
  }
  await expect(page.locator(".modular-dashboard")).toHaveCount(0);
}

async function expectNativeLoginRedirect(context: BrowserContext): Promise<void> {
  const page = await context.newPage();
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login(?:\?|$)/);
  await expect(page.getByRole("heading", { name: "Velkommen", exact: true })).toHaveCount(0);
  for (const [label] of dashboardCards) {
    await expect(page.getByText(label, { exact: true })).toHaveCount(0);
  }
  await page.close();
}

async function setHouseholdStatus(householdId: number, status: "pending" | "approved" | "revoked"): Promise<void> {
  const household = await payload.findByID({ collection: "households", id: householdId, overrideAccess: true });
  const updated = await payload.update({
    collection: "households",
    id: householdId,
    overrideAccess: true,
    data: { members: household.members.map((member) => ({ ...member, status })) },
  });
  assert.equal(updated.status, status);
}

async function keyboardNavigateMobileMenu(page: Page): Promise<void> {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/admin");
  const toggler = page.getByRole("button", { name: "Åpne Meny", exact: true });
  await toggler.focus();
  await expect(toggler).toBeFocused();
  await page.keyboard.press("Enter");
  const navigation = page.getByRole("navigation", { name: "Administrasjon" });
  await expect(navigation).toBeVisible();

  const postsLink = navigation.getByRole("link", { name: "Innlegg", exact: true });
  let focusedPosts = false;
  for (let step = 0; step < 20; step += 1) {
    await page.keyboard.press("Tab");
    if (await postsLink.evaluate((element) => element === document.activeElement)) {
      focusedPosts = true;
      break;
    }
  }
  assert(focusedPosts, "Keyboard focus must reach sidebar navigation links after opening the mobile menu");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/admin\/collections\/posts(?:\?|$)/);
  await expect(page.getByRole("button", { name: "Lukk meny", exact: true })).toBeHidden();
}

try {
  const email = `admin-dashboard-${randomBytes(8).toString("hex")}@example.invalid`;
  const password = randomBytes(24).toString("hex");
  const administrator = await payload.create({
    collection: "users",
    data: { name: "Dashboard test", email, password },
  });
  userId = administrator.id;

  browser = await chromium.launch();
  const adminContext = await browser.newContext({
    baseURL, viewport: { width: 1440, height: 1000 }, locale: "nb-NO", reducedMotion: "reduce",
  });
  const anonymousContext = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 }, locale: "nb-NO" });
  const guestContext = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 }, locale: "nb-NO" });
  assert((await adminContext.request.post("/api/users/login", { data: { email, password } })).ok(), "Native admin login failed");

  const adminPage = await adminContext.newPage();
  const pageErrors: string[] = [];
  adminPage.on("pageerror", (error) => pageErrors.push(error.message));

  await adminPage.goto("/admin");
  await expectDashboard(adminPage, { totalHouseholds: 0, pendingHouseholds: 0, visiblePosts: 0 });

  const adminServices = getHouseholdAdminServices(payload);
  const registrationServices = getHouseholdRegistrationServices(payload);
  const approved = await adminServices.create(registrationData("Godkjent"), administrator.id);
  householdIds.push(approved.householdId);
  const pending = await registrationServices.registration.register({
    ...registrationData("Ventende", ["Ventende medlem to", "Ventende medlem tre"]),
    invitationKey: registrationServices.invitation.getKey(),
  });
  householdIds.push(pending.householdId);
  const rejected = await adminServices.create(registrationData("Avslått"), administrator.id);
  householdIds.push(rejected.householdId);
  await setHouseholdStatus(rejected.householdId, "revoked");

  const publicPost = await payload.create({
    collection: "posts",
    data: {
      title: "Publisert for gjester",
      description: "Dette innlegget skal telles.",
      visibility: "public",
      publishedAt: "2029-01-01T12:00:00.000Z",
      _status: "published",
    },
  });
  postIds.push(publicPost.id);
  const privatePost = await payload.create({
    collection: "posts",
    data: {
      title: "Publisert privat",
      description: "Dette innlegget skal ikke telles.",
      visibility: "private",
      publishedAt: "2029-01-02T12:00:00.000Z",
      _status: "published",
    },
  });
  postIds.push(privatePost.id);
  const draftPost = await payload.create({
    collection: "posts",
    draft: true,
    data: {
      title: "Offentlig utkast",
      description: "Dette utkastet skal ikke telles.",
      visibility: "public",
      publishedAt: "2029-01-03T12:00:00.000Z",
      _status: "draft",
    },
  });
  postIds.push(draftPost.id);
  await payload.update({
    collection: "posts",
    id: publicPost.id,
    draft: true,
    data: {
      title: "Nyere privat utkast av publisert innlegg",
      description: "Den publiserte offentlige versjonen skal fortsatt telles.",
      visibility: "private",
      publishedAt: "2030-01-01T12:00:00.000Z",
      _status: "draft",
    },
  });

  const approvedCode = await registrationServices.codes.reveal(approved.householdId, administrator.id);
  const approvedHousehold = await payload.findByID({ collection: "households", id: approved.householdId, overrideAccess: true });
  const guestLogin = await guestContext.request.post("/api/household-login", {
    headers: { Origin: new URL(baseURL).origin },
    data: { householdName: approvedHousehold.displayName, accessCode: approvedCode, remember: false },
  });
  assert(guestLogin.ok(), `Approved guest login failed (${guestLogin.status()}): ${await guestLogin.text()}`);

  await expectNativeLoginRedirect(anonymousContext);
  await expectNativeLoginRedirect(guestContext);

  const fingerprintBeforeInitialReads = await domainFingerprint();
  await adminPage.goto("/admin");
  await expectDashboard(adminPage, { totalHouseholds: 3, pendingHouseholds: 1, visiblePosts: 1 });
  assert.equal(
    await domainFingerprint(), fingerprintBeforeInitialReads,
    "Dashboard reads must not rewrite households, posts or post versions",
  );

  await setHouseholdStatus(pending.householdId, "approved");
  await setHouseholdStatus(approved.householdId, "revoked");
  const fingerprintBeforeUpdatedReads = await domainFingerprint();
  await adminPage.reload();
  await expectDashboard(adminPage, { totalHouseholds: 3, pendingHouseholds: 0, visiblePosts: 1 });

  for (const width of [320, 390, 768, 1024, 1440]) {
    await adminPage.setViewportSize({ width, height: width <= 390 ? 844 : 1000 });
    await adminPage.goto("/admin");
    await expectDashboard(adminPage, { totalHouseholds: 3, pendingHouseholds: 0, visiblePosts: 1 });
    await expect.poll(() => adminPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const sectionBox = await dashboardSection(adminPage).boundingBox();
    assert(sectionBox && sectionBox.x >= -1 && sectionBox.x + sectionBox.width <= width + 1, `Dashboard must fit at ${width}px`);
    await adminPage.screenshot({ path: `/tmp/sammen-admin-dashboard-${width}.png`, fullPage: true });
  }
  assert.equal(
    await domainFingerprint(), fingerprintBeforeUpdatedReads,
    "Responsive dashboard rendering must remain read-only for source data",
  );

  await keyboardNavigateMobileMenu(adminPage);
  assert.deepEqual(pageErrors, []);
  console.log("PASS: isolated admin dashboard zero/current aggregates, household status changes, published guest-post filtering and draft revisions, native auth boundaries, static responsive cards, keyboard mobile navigation and read-only source data.");
} catch (error) {
  console.error(error);
  exitCode = 1;
} finally {
  await browser?.close();
  for (const id of postIds.reverse()) {
    await payload.delete({ collection: "posts", id, overrideAccess: true }).catch(() => undefined);
  }
  for (const id of householdIds.reverse()) {
    await payload.delete({ collection: "households", id, overrideAccess: true }).catch(() => undefined);
  }
  if (userId) await payload.delete({ collection: "users", id: userId, overrideAccess: true }).catch(() => undefined);
  await payload.destroy();
}
process.exit(exitCode);
