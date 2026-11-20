// End-to-end branding checks against the runner's freshly-created database only.
import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { chromium, expect, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { getPayload } from "payload";
import config from "../../payload.config";
import { getHouseholdAdminServices, getHouseholdRegistrationServices } from "../../features/households/composition-root";
import { HOUSEHOLD_SESSION_COOKIE } from "../../features/households/http/session-cookie";
import { weddingPath } from "../../features/wedding-site/paths";

const databaseUrl = new URL(process.env.DATABASE_URL || "");
assert(["localhost", "127.0.0.1"].includes(databaseUrl.hostname), "Local databases only");
assert(
  /^\/sammen_wedding_branding_test_\d+_[a-f0-9]+$/.test(databaseUrl.pathname),
  "Wedding branding tests require their explicitly guarded disposable database",
);
const baseURL = process.env.TEST_BASE_URL || "http://localhost:3115";
assert.equal(new URL(baseURL).port, "3115", "Wedding branding tests require their dedicated port");
assert(["localhost", "127.0.0.1"].includes(new URL(baseURL).hostname), "Local test server only");
assert(process.env.PAYLOAD_SECRET && process.env.HOUSEHOLD_ACCESS_SECRET, "The isolated runner must provide fresh test secrets");

const INITIAL_NAMES = "Åse & Øyvind";
const LONG_NAMES = "Alexandria %s Konstantinopolitana & Maximilianus von Bryllupsfesten";
const headers = { Origin: new URL(baseURL).origin };
const payload = await getPayload({ config });
let browser: Browser | undefined;
let exitCode = 0;

function normalized(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalized);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(
      ([key, nested]) => [key, normalized(nested)],
    ));
  }
  return value;
}

function digest(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(normalized(value))).digest("hex");
}

async function expectWeddingIcon(page: Page, monogram = "Å&Ø"): Promise<void> {
  const icon = page.locator('link[rel="icon"]');
  await expect(icon).toHaveCount(1);
  await expect(icon).toHaveAttribute("href", `${weddingPath("/brand-icon")}?v=${encodeURIComponent(monogram)}`);
  const response = await page.request.get((await icon.getAttribute("href"))!);
  assert.equal(response.status(), 200);
  assert.match(response.headers()["content-type"], /image\/svg\+xml/);
  assert.equal(response.headers()["cache-control"], "no-store");
  const svg = await response.text();
  assert(svg.includes(monogram.replaceAll("&", "&amp;")));
  assert(!svg.includes("<script"));
}

async function expectTitle(page: Page, path: string, label: string, names = INITIAL_NAMES): Promise<void> {
  await page.goto(path);
  await expect(page).toHaveTitle(`${label} · ${names}`);
  await expectWeddingIcon(page);
}

async function expectNoIndex(page: Page): Promise<void> {
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/i);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /nofollow/i);
}

async function loginHousehold(context: BrowserContext, householdName: string, accessCode: string): Promise<void> {
  const response = await context.request.post("/api/household-login", {
    headers,
    data: { householdName, accessCode, remember: false },
  });
  assert(response.ok(), `Household login failed (${response.status()})`);
}

async function invitationSnapshot(context: BrowserContext) {
  const response = await context.request.post("/api/household-invitation", { headers, data: {} });
  assert.equal(response.status(), 200);
  const invitation = await response.json() as { registrationUrl: string; qrDataUrl: string; qrSvg: string };
  const url = new URL(invitation.registrationUrl);
  const key = new URLSearchParams(url.hash.slice(1)).get("invitation");
  assert(key, "Invitation URL must retain a fragment key");
  return {
    origin: url.origin,
    pathname: url.pathname,
    search: url.search,
    keyDigest: digest(key),
    pngDigest: digest(invitation.qrDataUrl),
    svgDigest: digest(invitation.qrSvg),
  };
}

async function protectedStateSnapshot(administratorId: number) {
  const [households, sessions, votes, posts, postVersions, comments, administrator, program, programVersions] = await Promise.all([
    payload.find({ collection: "households", overrideAccess: true, showHiddenFields: true, pagination: false, depth: 0, sort: "id" }),
    payload.find({ collection: "household-sessions", overrideAccess: true, showHiddenFields: true, pagination: false, depth: 0, sort: "id" }),
    payload.find({ collection: "poll-votes", overrideAccess: true, pagination: false, depth: 0, sort: "id" }),
    payload.find({ collection: "posts", overrideAccess: true, draft: true, pagination: false, depth: 0, sort: "id", context: { skipLegacyBodyConversion: true } }),
    payload.findVersions({ collection: "posts", overrideAccess: true, pagination: false, depth: 0, sort: "id", context: { skipLegacyBodyConversion: true } }),
    payload.find({ collection: "program-comments", overrideAccess: true, pagination: false, depth: 0, sort: "id" }),
    payload.findByID({ collection: "users", id: administratorId, overrideAccess: true, depth: 0 }),
    payload.findGlobal({ slug: "program", overrideAccess: true, draft: true, depth: 0 }),
    payload.findGlobalVersions({ slug: "program", overrideAccess: true, pagination: false, depth: 0, sort: "id" }),
  ]);
  return {
    administratorIdentity: { id: administrator.id, name: administrator.name, email: administrator.email },
    householdIds: households.docs.map(({ id }) => id),
    householdStateDigest: digest(households.docs),
    sessionIds: sessions.docs.map(({ id }) => id),
    sessionStateDigest: digest(sessions.docs),
    voteIds: votes.docs.map(({ id }) => id),
    voteStateDigest: digest(votes.docs),
    postIds: posts.docs.map(({ id }) => id),
    postStateDigest: digest(posts.docs),
    postVersionIds: postVersions.docs.map(({ id }) => id),
    postVersionStateDigest: digest(postVersions.docs),
    commentIds: comments.docs.map(({ id }) => id),
    commentStateDigest: digest(comments.docs),
    commentAuthors: comments.docs.map(({ id, authorName }) => ({ id, authorName })),
    programVersionIds: programVersions.docs.map(({ id }) => id),
    programStateDigest: digest(program),
  };
}

async function expectNoHorizontalOverflow(page: Page, width: number, surface: string): Promise<void> {
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const body = await page.locator("body").boundingBox();
  assert(body && body.x >= -1 && body.x + body.width <= width + 1, `${surface} must fit at ${width}px`);
}

async function openSidebarWithKeyboard(page: Page): Promise<void> {
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto("/admin");
  const toggle = page.getByRole("button", { name: "Åpne Meny", exact: true });
  await toggle.focus();
  await page.keyboard.press("Enter");
  const navigation = page.getByRole("navigation", { name: "Administrasjon", exact: true });
  await expect(navigation).toBeVisible();
  await page.screenshot({ path: "/tmp/sammen-wedding-branding-admin-sidebar-open-320.png", fullPage: true });
  const programLink = navigation.getByRole("link", { name: "Program", exact: true });
  let reachedProgram = false;
  for (let index = 0; index < 20; index += 1) {
    await page.keyboard.press("Tab");
    if (await programLink.evaluate((element) => element === document.activeElement)) {
      reachedProgram = true;
      break;
    }
  }
  assert(reachedProgram, "Keyboard focus must reach Program in the mobile admin sidebar");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/admin\/globals\/program(?:\?|$)/);
  await expect(page).toHaveTitle(`Program · ${LONG_NAMES}`);
}

try {
  await payload.updateGlobal({
    slug: "wedding",
    data: {
      coupleNames: INITIAL_NAMES,
      weddingDate: "2029-06-23T12:00:00.000Z",
      venue: "Teststed",
      welcomeMessage: "Velkommen til testbryllupet.",
      heroEyebrow: "Vi gifter oss",
      heroTitleSuffix: "sitt bryllup",
      heroBackgroundMode: "color",
      heroBackgroundColor: "#3c4641",
    },
  });
  await payload.updateGlobal({
    slug: "program",
    data: {
      itinerary: { days: [{ id: "wedding", date: "2029-06-23", label: "Bryllupsdagen", items: [] }] },
      _status: "published",
    },
  });

  const email = `wedding-branding-${randomBytes(8).toString("hex")}@example.invalid`;
  const password = randomBytes(24).toString("hex");
  const administrator = await payload.create({
    collection: "users",
    data: { name: "Branding-redaktør", email, password },
  });
  const householdAdmin = getHouseholdAdminServices(payload);
  const registration = getHouseholdRegistrationServices(payload);
  const approved = await householdAdmin.create({
    requestKey: randomUUID(),
    contactName: "Godkjent Brandinggjest",
    displayName: "Godkjent brandinghusstand",
    email: "approved-branding@example.invalid",
    additionalMembers: [],
  }, administrator.id);
  const approvedCode = await registration.codes.reveal(approved.householdId, administrator.id);
  const pending = await registration.registration.register({
    invitationKey: registration.invitation.getKey(),
    requestKey: randomUUID(),
    contactName: "Ventende Brandinggjest",
    displayName: "Ventende brandinghusstand",
    email: "pending-branding@example.invalid",
    additionalMembers: [],
  });

  const publicPost = await payload.create({
    collection: "posts",
    data: { title: "Offentlig brandinginnlegg", description: "Synlig testinnlegg.", visibility: "public", _status: "published" },
  });
  const privatePost = await payload.create({
    collection: "posts",
    data: { title: "PRIVAT TITTEL MÅ IKKE LEKKE", description: "Privat.", visibility: "private", _status: "published" },
  });
  const draftPost = await payload.create({
    collection: "posts",
    draft: true,
    data: { title: "UTKASTTITTEL MÅ IKKE LEKKE", description: "Utkast.", visibility: "public", _status: "draft" },
  });
  await payload.create({
    collection: "poll-votes",
    overrideAccess: true,
    data: {
      post: publicPost.id,
      pollId: "branding-read-invariant",
      optionId: "yes",
      definition: { id: "branding-read-invariant", question: "Består brandingtesten?", open: true, options: [{ id: "yes", label: "Ja" }] },
      voteKey: randomBytes(32).toString("hex"),
    },
  });

  browser = await chromium.launch();
  const adminContext = await browser.newContext({ baseURL, viewport: { width: 1440, height: 1000 }, locale: "nb-NO", reducedMotion: "reduce" });
  const anonymousContext = await browser.newContext({ baseURL, viewport: { width: 1440, height: 1000 }, locale: "nb-NO", reducedMotion: "reduce" });
  const guestContext = await browser.newContext({ baseURL, viewport: { width: 1440, height: 1000 }, locale: "nb-NO", reducedMotion: "reduce" });
  const pendingContext = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 }, locale: "nb-NO", reducedMotion: "reduce" });
  assert((await adminContext.request.post("/api/users/login", { headers, data: { email, password } })).ok(), "Native admin login failed");
  await loginHousehold(guestContext, "Godkjent brandinghusstand", approvedCode);
  await loginHousehold(pendingContext, "Ventende brandinghusstand", pending.accessCode);
  const commentResponse = await guestContext.request.post(`/api/posts/${publicPost.id}/comments`, {
    headers,
    data: { requestKey: randomUUID(), body: "Branding må ikke endre forfatteren.", parentId: null },
  });
  assert(commentResponse.ok(), `Guest comment fixture failed (${commentResponse.status()})`);
  const guestComment = await commentResponse.json() as { authorName: string };
  assert.equal(guestComment.authorName, "Godkjent brandinghusstand");

  const approvedSessionBefore = (await guestContext.cookies()).find(({ name }) => name === HOUSEHOLD_SESSION_COOKIE)?.value;
  assert(approvedSessionBefore, "Approved guest must have an opaque session cookie");
  const invitationBefore = await invitationSnapshot(adminContext);
  assert.deepEqual(
    { origin: invitationBefore.origin, pathname: invitationBefore.pathname, search: invitationBefore.search },
    { origin: baseURL, pathname: weddingPath("/register"), search: "" },
  );
  const guestPage = await guestContext.newPage();
  const anonymousPage = await anonymousContext.newPage();
  const pendingPage = await pendingContext.newPage();
  const adminPage = await adminContext.newPage();
  const pageErrors: string[] = [];
  for (const page of [guestPage, anonymousPage, pendingPage, adminPage]) {
    page.on("pageerror", (error) => pageErrors.push(error.message));
  }

  await expectTitle(anonymousPage, weddingPath(), "Forside");
  await expect(anonymousPage.getByRole("link", { name: `${INITIAL_NAMES} – forside`, exact: true })).toHaveText("Å&Ø");
  await expect(anonymousPage.getByRole("heading", { level: 1 })).toContainText(INITIAL_NAMES, { timeout: 20_000 });

  // Regression: initializing Payload through an RSC branding read must not break the
  // process-local trusted creation capability subsequently used by the native API.
  const nativeHouseholdResponse = await adminContext.request.post("/api/household-admin", {
    headers,
    data: {
      requestKey: randomUUID(),
      contactName: "HTTP-opprettet Brandinggjest",
      displayName: "HTTP-opprettet brandinghusstand",
      email: "http-created-branding@example.invalid",
      additionalMembers: [{ name: "Ekstra HTTP-medlem" }],
    },
  });
  assert.equal(nativeHouseholdResponse.status(), 201, await nativeHouseholdResponse.text());
  const nativeHouseholdReceipt = await nativeHouseholdResponse.json() as { householdId: number };
  const nativeHousehold = await payload.findByID({
    collection: "households", id: nativeHouseholdReceipt.householdId, overrideAccess: true,
  });
  assert.equal(nativeHousehold.status, "approved");
  assert(nativeHousehold.members.every((member) => member.status === "approved"), "Native HTTP creation must approve every member");
  assert.deepEqual(nativeHousehold.members.map(({ name }) => name), ["HTTP-opprettet Brandinggjest", "Ekstra HTTP-medlem"]);

  const stateBefore = await protectedStateSnapshot(administrator.id);

  for (const [path, label] of [
    [weddingPath("/program"), "Program"],
    [weddingPath("/news"), "Innlegg"],
    [weddingPath(`/news/${publicPost.id}`), "Innlegg"],
    [weddingPath("/bilder"), "Bilder"],
  ] as const) {
    await expectTitle(guestPage, path, label);
    await expect(guestPage.getByRole("link", { name: `${INITIAL_NAMES} – forside`, exact: true })).toHaveText("Å&Ø");
  }

  await expectTitle(anonymousPage, weddingPath("/login"), "Logg inn");
  await expectNoIndex(anonymousPage);
  await expectTitle(pendingPage, weddingPath("/waiting"), "Venter på godkjenning");
  await expectNoIndex(pendingPage);

  await expectTitle(anonymousPage, weddingPath("/register"), "Registrer husstanden");
  await expectNoIndex(anonymousPage);
  await expect(anonymousPage.locator('meta[name="referrer"]')).toHaveAttribute("content", "no-referrer");

  for (const hidden of [privatePost, draftPost]) {
    await expectTitle(guestPage, weddingPath(`/news/${hidden.id}`), "Innlegg");
    await expect(guestPage.getByText(hidden.title, { exact: true })).toHaveCount(0);
    assert(!(await guestPage.content()).includes(hidden.title), "Private/draft article titles must not leak through metadata or streamed markup");
  }

  await anonymousPage.goto("/admin");
  await expect(anonymousPage).toHaveURL(/\/admin\/login(?:\?|$)/);
  await expect(anonymousPage).toHaveTitle(`Logg inn · ${INITIAL_NAMES}`);
  await expectNoIndex(anonymousPage);
  await expect(anonymousPage.locator(".wedding-admin-logo")).toContainText("Å&Ø");
  await expect(anonymousPage.locator(".wedding-admin-logo")).toContainText(INITIAL_NAMES);

  await adminPage.goto("/admin/globals/program");
  await expect(adminPage).toHaveTitle(`Program · ${INITIAL_NAMES}`);
  await expectNoIndex(adminPage);
  await expect(adminPage.locator(".wedding-nav__brand")).toContainText(INITIAL_NAMES);
  await expect(adminPage.locator(".wedding-nav__brand .wedding-monogram")).toHaveText("Å&Ø");
  await adminPage.goto(`/admin/collections/posts/${publicPost.id}`);
  await expect(adminPage).toHaveTitle(`Innlegg · ${INITIAL_NAMES}`);

  // Unsaved native editor state is local to that tab and must not become branding.
  await adminPage.goto("/admin/globals/wedding");
  await adminPage.locator("#field-coupleNames").fill("Ikke lagret & Skal ikke vises");
  await anonymousPage.goto(weddingPath());
  await expect(anonymousPage).toHaveTitle(`Forside · ${INITIAL_NAMES}`);
  await expect(anonymousPage.getByRole("heading", { level: 1 })).toContainText(INITIAL_NAMES, { timeout: 20_000 });

  const update = await adminContext.request.post("/api/globals/wedding", {
    headers,
    data: { coupleNames: LONG_NAMES },
  });
  assert(update.ok(), `Native wedding settings update failed (${update.status()})`);
  await expect.poll(async () => (await payload.findGlobal({ slug: "wedding", depth: 0 })).coupleNames).toBe(LONG_NAMES);

  // The same running server must read saved branding afresh on subsequent requests.
  await anonymousPage.goto(weddingPath());
  await expect(anonymousPage).toHaveTitle(`Forside · ${LONG_NAMES}`);
  await expectWeddingIcon(anonymousPage, "A&M");
  const platformIcon = await anonymousPage.request.get("/vartja-icon.svg");
  assert.equal(platformIcon.status(), 200);
  assert((await platformIcon.text()).includes(">VJ</text>"));
  assert.equal((await anonymousPage.request.get("/favicon.ico")).status(), 200);
  await expect(anonymousPage.getByRole("link", { name: `${LONG_NAMES} – forside`, exact: true })).toHaveText("A&M");
  await expect(anonymousPage.getByRole("heading", { level: 1 })).toContainText(LONG_NAMES, { timeout: 20_000 });
  await guestPage.goto(weddingPath("/program"));
  await expect(guestPage).toHaveTitle(`Program · ${LONG_NAMES}`);
  await expect(guestPage.getByRole("link", { name: `${LONG_NAMES} – forside`, exact: true })).toHaveText("A&M");
  await anonymousPage.goto("/admin/login");
  await expect(anonymousPage).toHaveTitle(`Logg inn · ${LONG_NAMES}`);
  await expect(anonymousPage.locator(".wedding-admin-logo")).toContainText(LONG_NAMES);
  await adminPage.goto("/admin/globals/program");
  await expect(adminPage).toHaveTitle(`Program · ${LONG_NAMES}`);
  await expectWeddingIcon(adminPage, "A&M");
  await expect(adminPage.locator(".wedding-nav__brand")).toContainText(LONG_NAMES);
  await adminPage.goto(`/admin/collections/posts/${publicPost.id}`);
  await expect(adminPage).toHaveTitle(`Innlegg · ${LONG_NAMES}`);
  await expect(adminPage.locator(".wedding-nav__brand .wedding-monogram")).toHaveText("A&M");

  for (const width of [320, 390, 1440]) {
    const height = width < 600 ? 844 : 1000;
    await anonymousPage.setViewportSize({ width, height });
    await anonymousPage.goto(weddingPath());
    await expect(anonymousPage.getByRole("heading", { level: 1 })).toContainText(LONG_NAMES, { timeout: 20_000 });
    await expectNoHorizontalOverflow(anonymousPage, width, "Guest branding");
    await anonymousPage.screenshot({ path: `/tmp/sammen-wedding-branding-guest-${width}.png`, fullPage: true });

    await anonymousPage.goto("/admin/login");
    await expectNoHorizontalOverflow(anonymousPage, width, "Admin login branding");
    await anonymousPage.screenshot({ path: `/tmp/sammen-wedding-branding-login-${width}.png`, fullPage: true });

    await adminPage.setViewportSize({ width, height });
    await adminPage.goto("/admin/globals/program");
    await expectNoHorizontalOverflow(adminPage, width, "Admin navigation branding");
    await adminPage.screenshot({ path: `/tmp/sammen-wedding-branding-admin-${width}.png`, fullPage: true });
  }
  await openSidebarWithKeyboard(adminPage);

  const invitationAfter = await invitationSnapshot(adminContext);
  assert.deepEqual(invitationAfter, invitationBefore, "Branding must not rotate invitation URLs or QR payloads");
  assert.equal(
    (await guestContext.cookies()).find(({ name }) => name === HOUSEHOLD_SESSION_COOKIE)?.value,
    approvedSessionBefore,
    "Branding reads and updates must not rotate the approved household session",
  );
  assert.equal((await (await guestContext.request.get("/api/household-session")).json()).household.householdId, approved.householdId);
  assert.deepEqual(
    await protectedStateSnapshot(administrator.id),
    stateBefore,
    "Branding must not rewrite administrator/household identities, credentials, sessions, votes, posts, post versions, comments or Program",
  );
  assert.deepEqual(pageErrors, []);

  console.log("PASS: disposable wedding branding across guest/admin metadata and logos, post-RSC native household creation, generic article privacy, saved-vs-unsaved freshness, stable identities/URLs/credentials/sessions/votes/posts/comments/Program, responsive long names and open keyboard admin navigation.");
} catch (error) {
  console.error(error);
  exitCode = 1;
} finally {
  await browser?.close();
  await payload.destroy();
}
process.exit(exitCode);
