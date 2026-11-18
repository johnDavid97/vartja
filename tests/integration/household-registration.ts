import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import { chromium, expect, type Browser } from "@playwright/test";
import { getPayload } from "payload";
import { sql } from "@payloadcms/db-postgres";
import config from "../../payload.config";
import { HouseholdCredentialProtection } from "../../features/households/infrastructure/HouseholdCredentialProtection";
import { PayloadHouseholdRepository } from "../../features/households/infrastructure/PayloadHouseholdRepository";

const databaseUrl = new URL(process.env.DATABASE_URL || "");
assert(["localhost", "127.0.0.1"].includes(databaseUrl.hostname));
assert(databaseUrl.pathname.startsWith("/sammen_households_test_"), "This test requires its disposable database runner");
const baseURL = process.env.TEST_BASE_URL || "http://localhost:3103";
assert(["localhost", "127.0.0.1"].includes(new URL(baseURL).hostname));
const payload = await getPayload({ config });
let browser: Browser | undefined;
let exitCode = 0;
try {
  const email = `household-admin-${randomUUID()}@example.invalid`;
  const password = randomBytes(24).toString("hex");
  const administrator = await payload.create({ collection: "users", data: { name: "Registration test", email, password } });
  browser = await chromium.launch();
  const admin = await browser.newContext({ baseURL, viewport: { width: 1440, height: 1100 } });
  const guest = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 } });
  const headers = { Origin: baseURL };
  assert((await admin.request.post("/api/users/login", { data: { email, password } })).ok());
  assert.equal((await guest.request.post("/api/household-invitation", { headers, data: {} })).status(), 403);
  assert.equal((await admin.request.post("/api/household-invitation", { headers: { Origin: "https://elsewhere.invalid" }, data: {} })).status(), 403);
  const invitationResponse = await admin.request.post("/api/household-invitation", { headers, data: {} });
  assert.equal(invitationResponse.status(), 200);
  const invitation = await invitationResponse.json() as { registrationUrl: string; qrDataUrl: string; qrSvg: string };
  assert(invitation.qrDataUrl.startsWith("data:image/png;base64,"));
  assert.match(invitation.qrSvg, /^<svg\s/);
  const registrationUrl = new URL(invitation.registrationUrl);
  assert.equal(registrationUrl.origin, baseURL, "Never navigate a fixture to a hosted website");
  assert.equal(registrationUrl.search, "");
  const invitationKey = new URLSearchParams(registrationUrl.hash.slice(1)).get("invitation");
  assert(invitationKey);

  const page = await guest.newPage();
  const browserErrors: string[] = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  await page.goto("/register");
  await expect(page.getByText("Åpne lenken fra invitasjonen", { exact: true })).toBeVisible();
  await page.goto(invitation.registrationUrl);
  await expect(page.locator("form")).toHaveCSS("display", "grid");
  await expect(page.locator("form")).toHaveCSS("gap", "32px");
  await expect(page.locator("body")).toHaveCSS("font-family", /Geist/);
  await page.getByLabel("Navn på kontaktperson", { exact: true }).fill("Alex Example");
  await page.getByLabel("E-postadresse", { exact: true }).fill("alex@example.invalid");
  await page.getByRole("button", { name: "Legg til familiemedlem", exact: true }).click();
  await page.getByLabel("Navn på familiemedlem 2", { exact: true }).fill("Robin Example");
  const registrationResponse = page.waitForResponse((response) => response.url().endsWith("/api/household-registration") && response.request().method() === "POST");
  await page.getByRole("button", { name: "Registrer husstanden", exact: true }).click();
  const registered = await registrationResponse;
  assert.equal(registered.status(), 201, await registered.text());
  const receipt = await registered.json() as { householdId: number; accessCode: string };
  await expect(page.getByText("Husstanden er registrert", { exact: true })).toBeVisible();
  await expect(page.locator("output")).toHaveText(receipt.accessCode);
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  assert.equal(await page.evaluate(() => localStorage.length), 0);
  const household = await payload.findByID({ collection: "households", id: receipt.householdId, overrideAccess: true });
  assert.equal(household.status, "pending");
  assert.deepEqual(household.members.map((member) => [member.name, member.status]), [["Alex Example", "pending"], ["Robin Example", "pending"]]);
  assert(!household.accessCodeEncrypted.includes(receipt.accessCode));
  assert.equal(new Set(household.members.map((member) => member.memberId)).size, 2);
  assert.equal((await guest.request.get(`/api/households/${household.id}`)).status(), 403);
  const ordinaryAdminRead = await (await admin.request.get(`/api/households/${household.id}`)).json();
  for (const key of ["publicId", "accessCodeDigest", "accessCodeEncrypted", "registrationRequestDigest", "registrationRequestFingerprint", "credentialVersion"]) {
    assert(!Object.hasOwn(ordinaryAdminRead, key), `${key} must not leak through native API reads`);
  }

  const adminPage = await admin.newPage();
  adminPage.on("pageerror", (error) => browserErrors.push(error.message));
  await adminPage.goto("/admin/collections/households");
  await expect(adminPage.getByText("Alex Example", { exact: true })).toBeVisible();
  await adminPage.goto("/admin/collections/households?tab=invitation");
  await expect(adminPage.getByRole("link", { name: "Åpne registreringsskjema", exact: true })).toHaveAttribute("href", invitation.registrationUrl);
  await adminPage.goto(`/admin/collections/households/${household.id}`);
  await expect(adminPage.getByRole("heading", { name: "Familiemedlemmer*", exact: true })).toBeVisible();
  await expect(adminPage.getByRole("button", { name: "Legg til Familiemedlem", exact: true })).toBeVisible();
  await adminPage.getByRole("combobox").first().click();
  await adminPage.getByRole("option", { name: "Godkjent", exact: true }).click();
  const approvalResponse = adminPage.waitForResponse((response) => response.url().includes(`/api/households/${household.id}`) && response.request().method() === "PATCH");
  await adminPage.getByRole("button", { name: "Lagre", exact: true }).click();
  const approval = await approvalResponse;
  assert(approval.ok(), await approval.text());
  const approved = await payload.findByID({ collection: "households", id: household.id });
  assert.equal(approved.status, "approved");
  assert(approved.members.every((member) => member.status === "approved"));
  assert.deepEqual(approved.members.map((member) => member.memberId), household.members.map((member) => member.memberId));
  const addedMemberResponse = await admin.request.patch(`/api/households/${household.id}`, {
    headers,
    data: { members: [...approved.members, { name: "New Family Member", status: "pending" }], accessCodeEncrypted: "must-not-be-saved", credentialVersion: 999 },
  });
  assert(addedMemberResponse.ok(), await addedMemberResponse.text());
  const withAddition = await payload.findByID({ collection: "households", id: household.id });
  assert.equal(withAddition.members.length, 3);
  assert.equal(withAddition.members[2].status, "pending");
  assert(withAddition.members[2].memberId);
  assert.equal(withAddition.credentialVersion, household.credentialVersion);
  assert.equal(withAddition.accessCodeEncrypted, household.accessCodeEncrypted);
  assert.equal((await guest.request.patch(`/api/households/${household.id}`, { headers, data: { status: "approved" } })).status(), 403);
  await adminPage.getByRole("button", { name: "Vis husstandskode", exact: true }).click();
  await expect(adminPage.locator("output[aria-label='Husstandskode']")).toHaveText(receipt.accessCode);

  const requestData = { invitationKey, requestKey: randomUUID(), contactName: "Retry Family", email: "retry@example.invalid", additionalMembers: [] };
  const concurrent = await Promise.all(Array.from({ length: 3 }, () => guest.request.post("/api/household-registration", { headers, data: requestData })));
  for (const response of concurrent) assert.equal(response.status(), 201, await response.text());
  const receipts = await Promise.all(concurrent.map((response) => response.json()));
  assert(receipts.every((value) => value.householdId === receipts[0].householdId && value.accessCode === receipts[0].accessCode));
  const retryHouseholdId: number = receipts[0].householdId;
  assert.equal((await guest.request.post("/api/household-registration", { headers, data: { ...requestData, email: "changed@example.invalid" } })).status(), 409);
  assert.equal((await guest.request.post("/api/household-registration", { headers, data: { ...requestData, status: "approved" } })).status(), 400);
  assert.equal((await guest.request.post("/api/household-registration", { headers, data: { ...requestData, invitationKey: "invalid" } })).status(), 403);
  assert.equal((await guest.request.post("/api/household-code", { headers, data: { householdId: retryHouseholdId, action: "reveal" } })).status(), 403);
  const reveal = await admin.request.post("/api/household-code", { headers, data: { householdId: retryHouseholdId, action: "reveal" } });
  assert.equal((await reveal.json()).accessCode, receipts[0].accessCode);
  const rotation = await admin.request.post("/api/household-code", { headers, data: { householdId: retryHouseholdId, action: "rotate" } });
  assert.equal(rotation.status(), 200, await rotation.text());
  assert.notEqual((await rotation.json()).accessCode, receipts[0].accessCode);
  assert.equal((await guest.request.post("/api/household-registration", { headers, data: requestData })).status(), 409);

  // Verify the real PostgreSQL CAS, not just a fake's implementation.
  const repository = new PayloadHouseholdRepository(payload);
  const credentials = new HouseholdCredentialProtection(process.env.HOUSEHOLD_ACCESS_SECRET!);
  const originalCredentials = await repository.findCredentials(retryHouseholdId);
  assert(originalCredentials);
  const audit = { householdId: retryHouseholdId, administratorId: administrator.id, action: "rotate" as const, occurredAt: new Date() };
  const casResults = await Promise.all(Array.from({ length: 2 }, () => repository.rotateCredentials(
    retryHouseholdId, originalCredentials.credentialVersion,
    credentials.protectCode(credentials.generateCode(), originalCredentials.publicId), audit,
  )));
  assert.deepEqual(casResults.sort(), [false, true]);
  const afterRace = await repository.findCredentials(retryHouseholdId);
  assert(afterRace);
  // A failing audit insert must roll back credential changes.
  await payload.db.drizzle.execute(sql`
    CREATE FUNCTION reject_household_test_audit() RETURNS trigger LANGUAGE plpgsql AS
    $$ BEGIN RAISE EXCEPTION 'Test audit unavailable'; END $$;
    CREATE TRIGGER reject_household_test_audit BEFORE INSERT ON household_credential_audits
    FOR EACH ROW EXECUTE FUNCTION reject_household_test_audit();
  `);
  try {
    await assert.rejects(repository.rotateCredentials(retryHouseholdId, afterRace.credentialVersion,
      credentials.protectCode(credentials.generateCode(), afterRace.publicId), audit));
  } finally {
    await payload.db.drizzle.execute(sql`
      DROP TRIGGER reject_household_test_audit ON household_credential_audits;
      DROP FUNCTION reject_household_test_audit();
    `);
  }
  assert.equal((await repository.findCredentials(retryHouseholdId))?.credentialVersion, afterRace.credentialVersion);
  const audits = await payload.find({ collection: "household-credential-audits", limit: 100 });
  assert(audits.docs.length >= 3);
  assert(!JSON.stringify(audits.docs).includes(receipts[0].accessCode));
  assert.equal((await guest.request.get("/api/household-credential-audits")).status(), 403);
  // Same limiter window persists across freshly constructed services/processes.
  const currentMinute = Math.floor(Date.now() / 60_000) * 60_000;
  for (const minute of [currentMinute, currentMinute + 60_000]) {
    const windowStart = new Date(minute).toISOString();
    await payload.db.drizzle.execute(sql`
      INSERT INTO household_registration_limits (window_key, window_start, attempts, created_at, updated_at)
      VALUES (${windowStart}, ${windowStart}, 100, now(), now())
      ON CONFLICT (window_key) DO UPDATE SET attempts = 100
    `);
  }
  const limited = await guest.request.post("/api/household-registration", { headers, data: { ...requestData, requestKey: randomUUID() } });
  assert.equal(limited.status(), 429);
  assert.deepEqual(browserErrors, []);
  console.log("PASS: browser registration, automatic contact member, real persistence, native admin approval, QR/link, private credentials, concurrent retries, code recovery/rotation, CAS, audit rollback, throttling and mobile layout.");
} catch (error) {
  console.error(error);
  exitCode = 1;
} finally {
  await browser?.close();
}
process.exit(exitCode);
