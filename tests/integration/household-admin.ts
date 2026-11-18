// This suite owns only disposable fixtures; never run it against the real wedding database.
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { chromium, expect, type Browser, type APIResponse } from "@playwright/test";
import { getPayload } from "payload";
import config from "../../payload.config";

const databaseUrl = new URL(process.env.DATABASE_URL || "");
assert(["localhost", "127.0.0.1"].includes(databaseUrl.hostname));
assert(/^\/sammen_household_admin_test_\d+_[a-f0-9]+$/.test(databaseUrl.pathname), "Disposable admin test database only");
const baseURL = process.env.TEST_BASE_URL || "http://localhost:3105";
assert(["localhost", "127.0.0.1"].includes(new URL(baseURL).hostname));
const payload = await getPayload({ config });
let browser: Browser | undefined;
let exitCode = 0;

function creationData(contactName: string, email: string, names: string[] = []) {
  return { requestKey: randomUUID(), contactName, email, additionalMembers: names.map((name) => ({ name })) };
}

try {
  const email = `household-ui-${randomUUID()}@example.invalid`;
  const password = randomBytes(24).toString("hex");
  await payload.create({ collection: "users", data: { name: "Household UI test", email, password } });
  browser = await chromium.launch();
  const admin = await browser.newContext({ baseURL, viewport: { width: 1440, height: 1100 }, locale: "nb-NO" });
  const guest = await browser.newContext({ baseURL });
  const headers = { Origin: baseURL };
  assert((await admin.request.post("/api/users/login", { data: { email, password } })).ok());
  const sample = creationData("Not created", "none@example.invalid");
  assert.equal((await guest.request.post("/api/household-admin", { headers, data: sample })).status(), 403);
  assert.equal((await guest.request.get("/api/household-summary")).status(), 403);
  assert.equal((await admin.request.post("/api/household-admin", { headers: { Origin: "https://elsewhere.invalid" }, data: sample })).status(), 403);
  assert.equal((await admin.request.post("/api/household-admin", { headers, data: { ...sample, status: "approved" } })).status(), 400);
  assert.equal((await admin.request.post("/api/households", { headers, data: { ...sample, context: { householdTrustedAdminCreation: true } } })).status(), 403);
  assert.deepEqual(await (await admin.request.get("/api/household-summary")).json(), { total: 0, pending: 0 });

  const invitationResponse = await admin.request.post("/api/household-invitation", { headers, data: {} });
  assert.equal(invitationResponse.status(), 200);
  const invitation: { registrationUrl: string; qrDataUrl: string; qrSvg: string } = await invitationResponse.json();
  const registrationUrl = new URL(invitation.registrationUrl);
  assert.equal(registrationUrl.origin, baseURL);
  const invitationKey = new URLSearchParams(registrationUrl.hash.slice(1)).get("invitation");
  assert(invitationKey);
  assert.match(invitation.qrSvg, /^<svg\s/);
  assert.match(invitationResponse.headers()["cache-control"], /no-store/);

  const pendingIds: number[] = [];
  for (const data of [
    creationData("Kari Nordmann", "kari@example.invalid", ["Ola Nordmann", "Ella Nordmann"]),
    creationData("Ingrid Berg", "ingrid@example.invalid", ["Jonas Berg"]),
    creationData("Marte Dahl", "marte@example.invalid", ["Anders Dahl"]),
  ]) {
    const response: APIResponse = await guest.request.post("/api/household-registration", { headers, data: { ...data, invitationKey } });
    assert.equal(response.status(), 201, await response.text());
    pendingIds.push((await response.json()).householdId);
  }
  const approvedIds: number[] = [];
  for (const data of [
    creationData("Lars Johansen", "lars@example.invalid"),
    creationData("Sofie Hansen", "sofie@example.invalid", ["Petter Hansen", "Maja Hansen", "Mikkel Hansen"]),
    creationData("Henrik Lie", "henrik@example.invalid", ["Nora Lie"]),
  ]) {
    const response = await admin.request.post("/api/household-admin", { headers, data });
    assert.equal(response.status(), 201, await response.text());
    const receipt = await response.json();
    assert.deepEqual(Object.keys(receipt), ["householdId"], "Creation must not reveal credentials");
    approvedIds.push(receipt.householdId);
    const household = await payload.findByID({ collection: "households", id: receipt.householdId });
    assert.equal(household.status, "approved");
    assert(household.members.every((member) => member.status === "approved"));
    assert.deepEqual(household.members.map((member) => member.name), [data.contactName, ...data.additionalMembers.map(({ name }) => name)]);
    assert.equal(household.credentialVersion, 1);
    assert(household.accessCodeEncrypted && household.accessCodeDigest);
  }
  assert((await admin.request.patch(`/api/households/${approvedIds[2]}`, { headers, data: { status: "revoked" } })).ok());
  assert.deepEqual(await (await admin.request.get("/api/household-summary")).json(), { total: 6, pending: 3 });

  const page = await admin.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/admin/collections/households");
  const table = page.locator(".admin-table");
  await expect(table.getByRole("row")).toHaveCount(7);
  await expect(table.getByText("kari@example.invalid", { exact: true })).toBeVisible();
  await expect(table.getByText("3 personer", { exact: true })).toBeVisible();
  await expect(table.getByText("Avslått", { exact: true })).toBeVisible();
  await expect(page.locator('.wedding-nav a[href^="/admin/collections/households"]')).toContainText("3");
  await expect(page.getByRole("link", { name: "Administratorer", exact: true })).toHaveAttribute("href", "/admin/collections/users");
  await page.screenshot({ path: "/tmp/sammen-households-overview.png", fullPage: true });

  await page.locator("#heading-contactName button").first().click();
  await expect(page).toHaveURL(/sort=contactName/);
  await expect(table.locator("tbody tr").first()).toContainText("Henrik Lie");
  await page.goto("/admin/collections/households?tab=overview&sort=contactName&limit=2");
  await expect(table.locator("tbody tr")).toHaveCount(2);
  await page.locator(".paginator .clickable-arrow--right").click();
  await expect(page).toHaveURL(/page=2/);
  await expect(table.locator("tbody tr").first()).toContainText("Kari Nordmann");
  await page.goto("/admin/collections/households?tab=overview&limit=10");
  await expect(table.locator("tbody tr")).toHaveCount(6);
  const search = page.locator(".search-filter input");
  await search.fill("kari@example.invalid");
  await expect(table.locator("tbody tr")).toHaveCount(1);
  await expect(table.getByText("Kari Nordmann", { exact: true })).toBeVisible();
  await search.fill("");
  await expect(table.locator("tbody tr")).toHaveCount(6);
  await page.goto("/admin/collections/households?where[status][equals]=pending");
  await expect(table.locator("tbody tr")).toHaveCount(3);
  await page.goto("/admin/collections/households");
  await expect(table.locator("tbody tr")).toHaveCount(6);
  const firstCheckbox = table.locator("tbody tr").first().getByRole("checkbox");
  await firstCheckbox.check();
  await expect(firstCheckbox).toBeChecked();
  await firstCheckbox.uncheck();
  await table.getByRole("link", { name: "Kari Nordmann", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/admin/collections/households/${pendingIds[0]}$`));
  await expect(page.getByRole("button", { name: "Vis husstandskode", exact: true })).toBeVisible();

  // A pending member in an approved household is not a pending household.
  const approved = await payload.findByID({ collection: "households", id: approvedIds[0] });
  assert((await admin.request.patch(`/api/households/${approved.id}`, { headers, data: { members: [...approved.members, { name: "Ny person", status: "pending" }] } })).ok());
  assert.deepEqual(await (await admin.request.get("/api/household-summary")).json(), { total: 6, pending: 3 });

  await page.goto("/admin/collections/households?tab=invitation");
  await expect(page.getByRole("heading", { name: "Felles invitasjon", exact: true })).toBeVisible();
  await expect(page.getByText("Nettsiden bruker en lokal adresse", { exact: true })).toBeVisible();
  await expect(page.getByRole("img", { name: "QR-kode til registreringsskjemaet" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Åpne registreringsskjema", exact: true })).toHaveAttribute("href", invitation.registrationUrl);
  const address = page.getByRole("textbox", { name: "Adresse", exact: true });
  assert(!(await address.inputValue()).includes(invitationKey));
  await page.getByRole("button", { name: "Vis invitasjonsnøkkelen", exact: true }).click();
  await expect(address).toHaveValue(invitation.registrationUrl);
  await page.getByRole("button", { name: "Skjul invitasjonsnøkkelen", exact: true }).click();
  assert(!(await address.inputValue()).includes(invitationKey));
  await admin.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.getByRole("button", { name: "Kopier lenken", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Invitasjonslenken er kopiert." })).toBeVisible();
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), invitation.registrationUrl);
  const png = page.getByRole("link", { name: /Last ned som PNG/ });
  const svg = page.getByRole("link", { name: /Last ned som SVG/ });
  await expect(png).toHaveAttribute("download", /\.png$/);
  await expect(svg).toHaveAttribute("download", /\.svg$/);
  const pngDownload = page.waitForEvent("download");
  await png.click();
  assert((await pngDownload).suggestedFilename().endsWith(".png"));
  const svgDownload = page.waitForEvent("download");
  await svg.click();
  assert((await svgDownload).suggestedFilename().endsWith(".svg"));
  await page.screenshot({ path: "/tmp/sammen-households-invitation.png", fullPage: true });

  for (const width of [1024, 768, 320, 390]) {
    for (const tab of ["invitation", "overview", "new"]) {
      await page.setViewportSize({ width, height: 844 });
      await page.goto(`/admin/collections/households?tab=${tab}`);
      if (tab === "invitation") await expect(page.getByRole("img", { name: "QR-kode til registreringsskjemaet" })).toBeVisible();
      if (tab === "overview") {
        await expect(table.locator("tbody tr")).toHaveCount(6);
        if (width < 768) {
          await table.focus();
          await page.keyboard.press("ArrowRight");
          await expect.poll(() => table.evaluate((node) => node.scrollLeft)).toBeGreaterThan(0);
          await table.evaluate((node) => { node.scrollLeft = 0; });
        }
      }
      if (tab === "new") await expect(page.getByLabel("Navn på kontaktperson", { exact: true })).toBeVisible();
      await expect(page.locator(".template-default__nav-toggler")).toBeVisible();
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: `/tmp/sammen-households-${tab}-${width}.png`, fullPage: true });
    }
  }
  await expect(page.locator(".template-default__nav-toggler .hamburger svg")).toBeVisible();
  await page.locator(".template-default__nav-toggler").click({ timeout: 5000 });
  await expect(page.locator(".wedding-nav--open")).toBeVisible();
  await page.locator('.wedding-nav a[href^="/admin/collections/households"]').click();
  await expect(table.locator("tbody tr")).toHaveCount(6);
  await page.getByRole("link", { name: /^Opprett ny/ }).click();
  await expect(page.getByRole("heading", { name: "Ny husstand", exact: true })).toBeVisible();
  await page.getByLabel("Navn på kontaktperson", { exact: true }).fill("Ada Testfamilie");
  await page.getByLabel("E-postadresse", { exact: true }).fill("ada@example.invalid");
  await page.getByRole("button", { name: "Legg til familiemedlem", exact: true }).click();
  await page.getByLabel("Navn på familiemedlem 2", { exact: true }).fill("Per Testfamilie");
  let persistedBeforeRetry: number | undefined;
  await page.route("**/api/household-admin", async (route) => {
    const persisted = await route.fetch();
    assert.equal(persisted.status(), 201);
    persistedBeforeRetry = (await persisted.json()).householdId;
    await route.abort("failed"); // The server saved successfully, but its reply was lost.
  });
  await page.getByRole("button", { name: "Opprett husstand", exact: true }).click();
  await expect(page.locator("form").getByRole("alert")).toContainText("samme forespørsel brukes trygt på nytt");
  await page.unroute("**/api/household-admin");
  const creationResponse = page.waitForResponse((response) => response.url().endsWith("/api/household-admin") && response.request().method() === "POST");
  await page.getByRole("button", { name: /Opprett husstand|Lagre husstand/, exact: true }).click();
  const created = await creationResponse;
  assert.equal(created.status(), 201, await created.text());
  const manualId: number = (await created.json()).householdId;
  assert.equal(manualId, persistedBeforeRetry, "A lost response must reuse the original creation request");
  await expect(page).toHaveURL(new RegExp(`/admin/collections/households/${manualId}$`));
  const manual = await payload.findByID({ collection: "households", id: manualId });
  assert.equal(manual.status, "approved");
  assert.deepEqual(manual.members.map((member) => [member.name, member.status]), [["Ada Testfamilie", "approved"], ["Per Testfamilie", "approved"]]);
  await page.getByRole("button", { name: "Vis husstandskode", exact: true }).click();
  await expect(page.locator("output[aria-label='Husstandskode']")).not.toBeEmpty();

  const retryData = creationData("Retry admin family", "retry-admin@example.invalid", ["Extra person"]);
  const concurrent = await Promise.all(Array.from({ length: 3 }, () => admin.request.post("/api/household-admin", { headers, data: retryData })));
  for (const response of concurrent) assert.equal(response.status(), 201, await response.text());
  const receipts = await Promise.all(concurrent.map((response) => response.json()));
  assert(receipts.every((receipt) => receipt.householdId === receipts[0].householdId));
  const retryId = receipts[0].householdId;
  assert.equal((await admin.request.post("/api/household-admin", { headers, data: { ...retryData, email: "changed@example.invalid" } })).status(), 409);
  assert((await admin.request.patch(`/api/households/${retryId}`, { headers, data: { status: "revoked" } })).ok());
  assert((await admin.request.post("/api/household-code", { headers, data: { householdId: retryId, action: "rotate" } })).ok());
  assert.equal((await admin.request.post("/api/household-admin", { headers, data: retryData })).status(), 201);
  const afterRetry = await payload.findByID({ collection: "households", id: retryId });
  assert.equal(afterRetry.status, "revoked", "An idempotent retry must not reapprove a household");
  assert.equal(afterRetry.credentialVersion, 2);
  const guestSameKey = await guest.request.post("/api/household-registration", { headers, data: { ...retryData, invitationKey } });
  assert.equal(guestSameKey.status(), 201, await guestSameKey.text());
  assert.notEqual((await guestSameKey.json()).householdId, retryId, "Guest and admin request keys must be isolated");
  const ordinaryRead = await (await admin.request.get(`/api/households/${manualId}`)).json();
  for (const field of ["accessCodeDigest", "accessCodeEncrypted", "registrationRequestDigest", "registrationRequestFingerprint", "credentialVersion", "publicId"]) assert(!Object.hasOwn(ordinaryRead, field));
  assert.deepEqual(errors, []);
  console.log("PASS: household tabs/shared list, search/filter/selection, invitation PNG/SVG, responsive form, approved admin creation, pending-only counts, private credentials and concurrent namespaced retries.");
} catch (error) {
  console.error(error);
  exitCode = 1;
} finally {
  await browser?.close();
  await payload.destroy();
}
process.exit(exitCode);
