import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { chromium, expect, type APIResponse, type Browser } from "@playwright/test";
import { getPayload } from "payload";
import config from "../../payload.config";
import { getHouseholdAdminServices, getHouseholdRegistrationServices } from "../../features/households/composition-root";
import { HOUSEHOLD_SESSION_COOKIE } from "../../features/households/http/session-cookie";
import { weddingPath } from "../../features/wedding-site/paths";

const databaseUrl = new URL(process.env.DATABASE_URL || "");
assert(["localhost", "127.0.0.1"].includes(databaseUrl.hostname), "Local databases only");
assert(
  /^\/sammen_wedding_routing_test_\d+_[a-f0-9]+$/.test(databaseUrl.pathname),
  "Wedding routing tests require their explicitly guarded disposable database",
);
const baseURL = process.env.TEST_BASE_URL || "http://localhost:3114";
assert(["localhost", "127.0.0.1"].includes(new URL(baseURL).hostname), "Local test server only");

const payload = await getPayload({ config });
let browser: Browser | undefined;
let exitCode = 0;

async function expectRedirect(response: APIResponse, status: number, pathname: string, search = "") {
  assert.equal(response.status(), status);
  const location = new URL(response.headers().location, baseURL);
  assert.equal(location.pathname, pathname);
  assert.equal(location.search, search);
}

try {
  const email = `wedding-routing-${randomBytes(6).toString("hex")}@example.invalid`;
  const password = randomBytes(24).toString("hex");
  const administrator = await payload.create({
    collection: "users",
    data: { name: "Wedding routing test", email, password },
  });
  const households = getHouseholdAdminServices(payload);
  const registration = getHouseholdRegistrationServices(payload);
  const approved = await households.create({
    requestKey: randomUUID(),
    contactName: "Godkjent Gjest",
    displayName: "Godkjent husstand",
    email: "approved@example.invalid",
    additionalMembers: [],
  }, administrator.id);
  const approvedCode = await registration.codes.reveal(approved.householdId, administrator.id);

  browser = await chromium.launch();
  const admin = await browser.newContext({ baseURL });
  const anonymous = await browser.newContext({ baseURL });
  const approvedGuest = await browser.newContext({ baseURL });
  const headers = { Origin: baseURL };
  assert((await admin.request.post("/api/users/login", { data: { email, password } })).ok());

  const landing = await anonymous.request.get("/", { maxRedirects: 0 });
  assert.equal(landing.status(), 200);
  assert((await landing.text()).includes("VårtJa"));
  await expectRedirect(await anonymous.request.get(weddingPath("/admin"), { maxRedirects: 0 }), 307, "/admin");
  await expectRedirect(
    await anonymous.request.get(`${weddingPath("/admin/collections/posts")}?page=2`, { maxRedirects: 0 }),
    307, "/admin/collections/posts", "?page=2",
  );
  const adminShortcutPage = await anonymous.newPage();
  await adminShortcutPage.goto(weddingPath("/admin"));
  await expect(adminShortcutPage).toHaveURL(/\/admin\/login(?:\?|$)/);
  await adminShortcutPage.close();
  const authenticatedShortcutPage = await admin.newPage();
  await authenticatedShortcutPage.goto(weddingPath("/admin"));
  await expect(authenticatedShortcutPage).toHaveURL(new URL("/admin", baseURL).toString());
  await expect(authenticatedShortcutPage.getByRole("heading", { name: "Velkommen", exact: true })).toBeVisible();
  await authenticatedShortcutPage.close();
  assert.equal((await anonymous.request.get("/another-couple/admin", { maxRedirects: 0 })).status(), 404);
  for (const [legacy, canonical] of [
    ["/news", weddingPath("/news")],
    ["/program", weddingPath("/program")],
    ["/bilder", weddingPath("/bilder")],
    ["/login", weddingPath("/login")],
    ["/waiting", weddingPath("/waiting")],
    ["/register", weddingPath("/register")],
  ] as const) {
    await expectRedirect(await anonymous.request.get(legacy, { maxRedirects: 0 }), 308, canonical);
  }
  await expectRedirect(
    await anonymous.request.get("/news/42?from=archive&page=2", { maxRedirects: 0 }),
    308,
    weddingPath("/news/42"),
    "?from=archive&page=2",
  );
  await expectRedirect(
    await anonymous.request.get("/news?page=2&theme=reise", { maxRedirects: 0 }),
    308,
    weddingPath("/news"),
    "?page=2&theme=reise",
  );

  const invitationResponse = await admin.request.post("/api/household-invitation", { headers, data: {} });
  assert.equal(invitationResponse.status(), 200);
  const invitation = await invitationResponse.json() as { registrationUrl: string; qrDataUrl: string; qrSvg: string };
  const repeatedInvitation = await (await admin.request.post("/api/household-invitation", { headers, data: {} })).json() as typeof invitation;
  const canonicalInvitationUrl = new URL(invitation.registrationUrl);
  assert.equal(canonicalInvitationUrl.pathname, weddingPath("/register"));
  assert.equal(canonicalInvitationUrl.search, "");
  const invitationKey = new URLSearchParams(canonicalInvitationUrl.hash.slice(1)).get("invitation");
  assert(invitationKey);
  assert.equal(repeatedInvitation.registrationUrl, invitation.registrationUrl, "Shared invitation URL must retain its stable key");
  assert.equal(repeatedInvitation.qrDataUrl, invitation.qrDataUrl, "QR PNG must encode that same stable URL");
  assert.equal(repeatedInvitation.qrSvg, invitation.qrSvg, "QR SVG must encode that same stable URL");

  const registrationPage = await anonymous.newPage();
  const requestedUrls: string[] = [];
  registrationPage.on("request", (request) => requestedUrls.push(request.url()));
  const oldQrUrl = new URL("/register", baseURL);
  oldQrUrl.hash = canonicalInvitationUrl.hash;
  await registrationPage.goto(oldQrUrl.toString());
  await expect(registrationPage).toHaveURL(new RegExp(`${weddingPath("/register")}#invitation=`));
  assert.equal(new URL(registrationPage.url()).hash, canonicalInvitationUrl.hash, "HTTP redirect must preserve the invitation fragment");
  assert(requestedUrls.every((url) => !url.includes(invitationKey)), "Invitation keys must remain in the fragment and never enter request URLs");
  await registrationPage.getByLabel("Navn på kontaktperson", { exact: true }).fill("QR Gjest");
  await registrationPage.getByLabel("E-postadresse", { exact: true }).fill("qr-guest@example.invalid");
  await registrationPage.getByLabel("Husstandsnavn", { exact: true }).fill("QR-husstanden");
  const registrationRequest = registrationPage.waitForResponse(
    (response) => response.url().endsWith("/api/household-registration") && response.request().method() === "POST",
  );
  await registrationPage.getByRole("button", { name: "Registrer husstanden", exact: true }).click();
  const registeredResponse = await registrationRequest;
  assert.equal(registeredResponse.status(), 201, await registeredResponse.text());
  const receipt = await registeredResponse.json() as { householdId: number; accessCode: string };
  await expect(registrationPage.getByText("Husstanden er registrert", { exact: true })).toBeVisible();
  assert(requestedUrls.every((url) => !url.includes(invitationKey)), "Registration must keep invitation keys out of request URLs");

  const adminPage = await admin.newPage();
  await adminPage.goto("/admin");
  await expect(adminPage.getByRole("link", { name: "Se nettsiden", exact: true })).toHaveAttribute("href", weddingPath());

  const approvedPage = await approvedGuest.newPage();
  const approvedLogin = await approvedGuest.request.post("/api/household-login", {
    headers,
    data: { householdName: "Godkjent husstand", accessCode: approvedCode, remember: true },
  });
  assert(approvedLogin.ok());
  const sessionCookieBeforeNavigation = (await approvedGuest.cookies()).find(({ name }) => name === HOUSEHOLD_SESSION_COOKIE);
  assert(sessionCookieBeforeNavigation?.value, "Approved login must issue a household session cookie");
  // Real authenticated sessions must see the same static platform page, not private wedding data.
  for (const context of [approvedGuest, admin]) {
    const signedInLanding = await context.request.get("/", { maxRedirects: 0 });
    assert.equal(signedInLanding.status(), 200);
    assert.equal(await signedInLanding.text(), await landing.text());
    assert.equal(signedInLanding.headers()["set-cookie"], undefined, "Landing must not alter authentication cookies");
  }
  await approvedPage.goto("/program");
  await expect(approvedPage).toHaveURL(new RegExp(`${weddingPath("/program")}$`));
  await expect(approvedPage.getByRole("heading", { name: "Programmet", exact: true })).toBeVisible();
  assert.equal(
    (await approvedGuest.cookies()).find(({ name }) => name === HOUSEHOLD_SESSION_COOKIE)?.value,
    sessionCookieBeforeNavigation.value,
    "The approved session token must survive navigation through an old page alias",
  );
  await approvedPage.goto(weddingPath());
  await expect(approvedPage.getByRole("link", { name: "Program", exact: true })).toHaveAttribute("href", weddingPath("/program"));
  await expect(approvedPage.getByRole("link", { name: "Innlegg", exact: true })).toHaveAttribute("href", weddingPath("/news"));
  await approvedPage.goto(weddingPath("/news"));
  await expect(approvedPage).toHaveURL(new RegExp(`${weddingPath("/news")}$`));
  await expect(approvedPage.getByRole("heading", { name: "Innlegg", exact: true })).toBeVisible();
  assert.equal(
    (await approvedGuest.cookies()).find(({ name }) => name === HOUSEHOLD_SESSION_COOKIE)?.value,
    sessionCookieBeforeNavigation.value,
    "The approved session token must remain unchanged on canonical wedding pages",
  );
  assert.equal((await (await approvedGuest.request.get("/api/household-session")).json()).household.householdId, approved.householdId);
  assert.equal((await approvedGuest.request.get(`${weddingPath()}/api/household-session`)).status(), 404, "The wedding prefix is not an API base");

  await approvedPage.setViewportSize({ width: 390, height: 844 });
  await approvedPage.goto(weddingPath());
  const menuButton = approvedPage.getByRole("button", { name: "Åpne meny", exact: true });
  await menuButton.focus();
  await approvedPage.keyboard.press("Enter");
  await expect(approvedPage.getByRole("navigation", { name: "Hovedmeny" }).filter({ visible: true }))
    .toContainText("Innlegg");
  await expect(approvedPage.getByRole("link", { name: "Program", exact: true }).filter({ visible: true }))
    .toHaveAttribute("href", weddingPath("/program"));
  await approvedPage.screenshot({ path: "/tmp/sammen-wedding-routing-mobile-nav.png", fullPage: true });
  await approvedPage.keyboard.press("Escape");
  await expect(menuButton).toBeFocused();
  await expect(menuButton).toHaveAttribute("aria-expanded", "false");

  const pending = await browser.newContext({ baseURL });
  const pendingLogin = await pending.request.post("/api/household-login", {
    headers,
    data: { householdName: "QR-husstanden", accessCode: receipt.accessCode, remember: false },
  });
  assert(pendingLogin.ok());
  const pendingPage = await pending.newPage();
  await pendingPage.goto(weddingPath("/program"));
  await expect(pendingPage).toHaveURL(new RegExp(`${weddingPath("/waiting")}$`));
  const pendingHousehold = await payload.findByID({ collection: "households", id: receipt.householdId });
  await payload.update({
    collection: "households",
    id: receipt.householdId,
    data: { members: pendingHousehold.members.map((member) => ({ ...member, status: "approved" })) },
  });
  await pendingPage.getByRole("button", { name: "Sjekk godkjenning", exact: true }).click();
  await expect(pendingPage).toHaveURL(new RegExp(`${weddingPath()}$`));
  await pendingPage.getByRole("button", { name: "Logg ut", exact: true }).click();
  await expect(pendingPage).toHaveURL(new RegExp(`${weddingPath()}$`));
  await pendingPage.goto(weddingPath("/program"));
  await expect(pendingPage).toHaveURL(new RegExp(`${weddingPath("/login")}$`));
  await pendingPage.getByLabel("Husstandsnavn", { exact: true }).fill("QR-husstanden");
  await pendingPage.getByLabel("Husstandskode", { exact: true }).fill(receipt.accessCode);
  await pendingPage.getByRole("button", { name: "Logg inn", exact: true }).click();
  await expect(pendingPage).toHaveURL(new RegExp(`${weddingPath()}$`));

  for (const path of [
    "/ukjent-bryllup",
    "/ukjent-bryllup/program",
    "/reiseplan",
    "/ting-a-gjore",
    "/wedding-party",
    weddingPath("/reiseplan"),
    weddingPath("/ting-a-gjore"),
    weddingPath("/wedding-party"),
  ]) {
    assert.equal((await anonymous.request.get(path)).status(), 404, `${path} must remain not found`);
  }
  assert.equal((await anonymous.request.get("/api/household-session")).status(), 200, "Root API routes must remain reachable");
  assert.equal((await anonymous.request.get("/admin/login")).status(), 200, "Admin routes must remain at root");

  console.log("PASS: canonical wedding aliases, fragments and QR registration, namespaced access/session flows, navigation, root APIs/admin, and isolated 404 boundaries.");
} catch (error) {
  console.error(error);
  exitCode = 1;
} finally {
  await browser?.close();
  await payload.destroy();
}
process.exit(exitCode);
