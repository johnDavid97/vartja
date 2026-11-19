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
assert(/^\/sammen_(households|household_members)_test_\d+_[a-f0-9]+$/.test(databaseUrl.pathname), "This test requires its disposable database runner");
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
  await expect(page.getByLabel("Husstandsnavn", { exact: true })).toHaveValue("Alex og Robin");
  await page.getByLabel("Husstandsnavn", { exact: true }).fill("Familien Example");
  await page.screenshot({ path: "/tmp/sammen-household-name-registration-390.png", fullPage: true });
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
  assert.equal(household.displayName, "Familien Example");
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
  async function saveDetails() {
    const responsePromise = adminPage.waitForResponse((response) => response.url().includes(`/api/households/${household.id}`) && response.request().method() === "PATCH");
    await adminPage.getByRole("button", { name: "Lagre", exact: true }).click();
    const response = await responsePromise;
    assert(response.ok(), await response.text());
  }
  await adminPage.goto("/admin/collections/households");
  await expect(adminPage.getByText("Alex Example", { exact: true })).toBeVisible();
  await adminPage.goto("/admin/collections/households?tab=invitation");
  await expect(adminPage.getByRole("link", { name: "Åpne registreringsskjema", exact: true })).toHaveAttribute("href", invitation.registrationUrl);
  await adminPage.goto(`/admin/collections/households/${household.id}`);
  await expect(adminPage.getByRole("heading", { name: "Familiemedlemmer", exact: true })).toBeVisible();
  await expect(adminPage.getByRole("button", { name: "Legg til familiemedlem", exact: true })).toBeVisible();
  await expect(adminPage.getByRole("heading", { name: "Familien Example", exact: true })).toBeVisible();
  await expect(adminPage.getByRole("button", { name: "Godkjenn alle", exact: true })).toBeEnabled();
  await expect(adminPage.locator(".household-editor-heading")).not.toContainText("Ikke lagret");
  await expect(adminPage.locator(".household-member-avatar")).toHaveCount(2);
  await expect(adminPage.locator(".household-member-avatar").nth(0)).toHaveText("AE");
  for (const row of await adminPage.locator(".household-member-row").all()) {
    await expect(row.getByRole("radio", { name: "Venter", exact: true })).toBeVisible();
    await expect(row.getByRole("radio", { name: "Godkjent", exact: true })).toBeVisible();
    await expect(row.getByRole("radio", { name: "Avslått", exact: true })).toBeVisible();
  }
  await adminPage.locator("#field-displayName").fill("Familien Example Live");
  await expect(adminPage.getByRole("heading", { name: "Familien Example Live", exact: true })).toBeVisible();
  await adminPage.locator("#field-displayName").fill("Familien Example");
  await adminPage.waitForLoadState("networkidle");
  for (const width of [1440, 1024, 768, 390, 320]) {
    await adminPage.setViewportSize({ width, height: 1100 });
    assert(await adminPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Household editor must fit ${width}px`);
    const contactCard = await adminPage.locator(".household-contact").boundingBox();
    const membersCard = await adminPage.locator("section.household-members").boundingBox();
    const sidebar = await adminPage.locator(".document-fields__sidebar-wrap").boundingBox();
    const accountLink = await adminPage.locator(".app-header__account").boundingBox();
    assert(contactCard && membersCard && sidebar && accountLink);
    assert(contactCard.x >= 10 && contactCard.x + contactCard.width <= width - 10, "Contact card needs a visible outer gutter");
    assert(accountLink.x + accountLink.width <= width, "Account link must remain on screen");
    assert(membersCard.x >= 10 && membersCard.x + membersCard.width <= width - 10, "Member rows need a visible outer gutter");
    if (width === 1440) {
      assert(sidebar.x >= contactCard.x + contactCard.width + 20, "Sidebar cards must not overlap the form");
      const nameField = await adminPage.locator("#field-displayName").boundingBox();
      const contactField = await adminPage.locator("#field-contactName").boundingBox();
      const emailField = await adminPage.locator("#field-email").boundingBox();
      assert(nameField && contactField && emailField);
      assert(Math.abs(contactField.y - emailField.y) < 2, "Contact name and email must share a row");
      assert(emailField.x > contactField.x + contactField.width, "Contact fields need a visible column gap");
      assert(nameField.width > contactField.width * 1.8, "Household name must span the contact columns");
    }
    await adminPage.screenshot({ path: `/tmp/sammen-household-editor-${width}.png`, fullPage: true });
  }
  await adminPage.setViewportSize({ width: 1440, height: 1100 });
  const firstMemberRow = adminPage.locator(".household-member-row").nth(0);
  await firstMemberRow.getByRole("radio", { name: "Godkjent", exact: true }).check();
  await expect(adminPage.locator(".household-editor-heading")).toContainText("Ikke lagret");
  assert.equal((await payload.findByID({ collection: "households", id: household.id })).status, "pending", "Individual approval must wait for the explicit save");
  await saveDetails();
  const individuallyApproved = await payload.findByID({ collection: "households", id: household.id });
  assert.equal(individuallyApproved.status, "approved");
  assert.deepEqual(individuallyApproved.members.map((member) => member.status), ["approved", "pending"], "Individual approval must not approve other members");
  assert.deepEqual(individuallyApproved.members.map((member) => member.memberId), household.members.map((member) => member.memberId));

  await firstMemberRow.getByRole("radio", { name: "Avslått", exact: true }).check();
  await saveDetails();
  const mixedPendingAndRejected = await payload.findByID({ collection: "households", id: household.id });
  assert.deepEqual(mixedPendingAndRejected.members.map((member) => member.status), ["revoked", "pending"]);
  assert.equal(mixedPendingAndRejected.status, "pending", "A pending member keeps a household with rejected members pending");
  const secondMemberRow = adminPage.locator(".household-member-row").nth(1);
  await secondMemberRow.getByRole("radio", { name: "Avslått", exact: true }).check();
  await saveDetails();
  assert.equal((await payload.findByID({ collection: "households", id: household.id })).status, "revoked", "All rejected members revoke the household");
  await adminPage.locator('#field-members__1__name').fill("Robin Rejected Rename");
  await saveDetails();
  const rejectedRename = await payload.findByID({ collection: "households", id: household.id });
  assert.equal(rejectedRename.members[1].name, "Robin Rejected Rename");
  assert.equal(rejectedRename.members[1].status, "revoked", "Editing a rejected member's name must retain rejection");

  await adminPage.getByRole("button", { name: "Godkjenn alle", exact: true }).click();
  await expect(adminPage.locator(".household-member-row").nth(0).getByRole("radio", { name: "Godkjent", exact: true })).toBeChecked();
  await expect(adminPage.locator(".household-member-row").nth(1).getByRole("radio", { name: "Godkjent", exact: true })).toBeChecked();
  assert.equal((await payload.findByID({ collection: "households", id: household.id })).status, "revoked", "Approve all must wait for Save");
  await saveDetails();
  const approved = await payload.findByID({ collection: "households", id: household.id });
  assert.equal(approved.status, "approved");
  assert(approved.members.every((member) => member.status === "approved"), "Approve all must reapprove rejected members");
  await adminPage.locator("#field-email").fill("updated@example.invalid");
  await adminPage.locator('#field-members__1__name').fill("Robin Updated");
  await adminPage.getByRole("button", { name: "Legg til familiemedlem", exact: true }).click();
  await adminPage.locator('#field-members__2__name').fill("Added in editor");
  await saveDetails();
  const edited = await payload.findByID({ collection: "households", id: household.id });
  assert.equal(edited.email, "updated@example.invalid");
  assert.equal(edited.members[1].name, "Robin Updated");
  assert.equal(edited.members[1].memberId, approved.members[1].memberId);
  assert.equal(edited.members[1].status, "approved");
  assert.equal(edited.members[2].status, "pending");
  assert.equal(edited.status, "approved");
  await expect(adminPage.getByRole("button", { name: /^Flytt familiemedlem/ })).toHaveCount(0);
  await expect(adminPage.locator('#field-members__1__name')).toHaveValue("Robin Updated");
  await expect(adminPage.locator('#field-members__2__name')).toHaveValue("Added in editor");
  await adminPage.locator(".household-member-row").nth(2).getByRole("radio", { name: "Godkjent", exact: true }).check();
  const robinRow = adminPage.locator(".household-member-row").nth(1);
  await robinRow.getByRole("radio", { name: "Godkjent", exact: true }).focus();
  await adminPage.keyboard.press("ArrowLeft");
  await expect(robinRow.getByRole("radio", { name: "Venter", exact: true })).toBeChecked();
  const beforeToggleSave = await payload.findByID({ collection: "households", id: household.id });
  assert.equal(beforeToggleSave.members.find((member) => member.memberId === edited.members[2].memberId)?.status, "pending", "Approval toggle must wait for Save");
  assert.equal(beforeToggleSave.members.find((member) => member.memberId === edited.members[1].memberId)?.status, "approved", "Pending toggle must wait for Save");
  await saveDetails();
  const memberApproved = await payload.findByID({ collection: "households", id: household.id });
  assert.deepEqual(memberApproved.members.map((member) => member.memberId), edited.members.map((member) => member.memberId));
  assert.equal(memberApproved.members[2].status, "approved");
  assert.equal(memberApproved.members[1].status, "pending", "Toggles must update the intended member without changing order");
  await adminPage.getByRole("button", { name: "Legg til familiemedlem", exact: true }).click();
  await adminPage.locator('#field-members__3__name').fill("Temporary member");
  await saveDetails();
  assert.equal((await payload.findByID({ collection: "households", id: household.id })).members.length, 4);
  await adminPage.getByRole("button", { name: "Fjern familiemedlem 4", exact: true }).click();
  await saveDetails();
  assert.deepEqual((await payload.findByID({ collection: "households", id: household.id })).members.map((member) => member.memberId), memberApproved.members.map((member) => member.memberId));
  for (const row of await adminPage.locator(".household-member-row").all()) {
    await row.getByRole("radio", { name: "Avslått", exact: true }).check();
  }
  assert.equal((await payload.findByID({ collection: "households", id: household.id })).status, "approved", "Rejection must wait for Save");
  await saveDetails();
  assert.equal((await payload.findByID({ collection: "households", id: household.id })).status, "revoked");
  await adminPage.getByRole("button", { name: "Godkjenn alle", exact: true }).click();
  await saveDetails();
  const beforeAddition = await payload.findByID({ collection: "households", id: household.id });
  const addedMemberResponse = await admin.request.patch(`/api/households/${household.id}`, {
    headers,
    data: { members: [...beforeAddition.members, { name: "New Family Member", status: "pending" }], accessCodeEncrypted: "must-not-be-saved", credentialVersion: 999 },
  });
  assert(addedMemberResponse.ok(), await addedMemberResponse.text());
  const withAddition = await payload.findByID({ collection: "households", id: household.id });
  assert.equal(withAddition.members.length, 4);
  assert.equal(withAddition.members[3].status, "pending");
  assert(withAddition.members[3].memberId);
  assert.equal(withAddition.status, "approved", "Any approved member makes the household approved");
  assert.equal(withAddition.credentialVersion, household.credentialVersion);
  assert.equal(withAddition.accessCodeEncrypted, household.accessCodeEncrypted);
  const ignoredStatusPatch = await admin.request.patch(`/api/households/${household.id}`, { headers, data: { status: "revoked" } });
  assert(ignoredStatusPatch.ok(), await ignoredStatusPatch.text());
  const afterIgnoredStatusPatch = await payload.findByID({ collection: "households", id: household.id });
  assert.equal(afterIgnoredStatusPatch.status, "approved", "A status-only native PATCH must not override the member-derived status");
  assert.deepEqual(afterIgnoredStatusPatch.members, withAddition.members, "A status-only native PATCH must not change members");
  const contradictoryPatch = await admin.request.patch(`/api/households/${household.id}`, {
    headers,
    data: { status: "approved", members: afterIgnoredStatusPatch.members.map((member) => ({ ...member, status: "revoked" })) },
  });
  assert(contradictoryPatch.ok(), await contradictoryPatch.text());
  const afterContradictoryPatch = await payload.findByID({ collection: "households", id: household.id });
  assert.equal(afterContradictoryPatch.status, "revoked", "Submitted household status cannot override rejected member statuses");
  assert(afterContradictoryPatch.members.every((member) => member.status === "revoked"));
  assert.equal((await guest.request.patch(`/api/households/${household.id}`, { headers, data: { status: "approved" } })).status(), 403);
  await adminPage.getByRole("button", { name: "Vis husstandskoden", exact: true }).click();
  await expect(adminPage.locator("output[aria-label='Husstandskode']")).toHaveText(receipt.accessCode);
  await admin.grantPermissions(["clipboard-read", "clipboard-write"]);
  await adminPage.getByRole("button", { name: "Kopier koden", exact: true }).click();
  assert.equal(await adminPage.evaluate(() => navigator.clipboard.readText()), receipt.accessCode);
  await adminPage.getByRole("button", { name: "Skjul husstandskoden", exact: true }).click();
  await expect(adminPage.locator("output[aria-label='Husstandskode']")).toHaveCount(0);
  adminPage.once("dialog", (dialog) => dialog.dismiss());
  await adminPage.getByRole("button", { name: "Lag ny kode", exact: true }).click();
  assert.equal((await payload.findByID({ collection: "households", id: household.id })).credentialVersion, 1);
  adminPage.once("dialog", (dialog) => dialog.accept());
  await adminPage.getByRole("button", { name: "Lag ny kode", exact: true }).click();
  await expect(adminPage.getByText("Ny kode er laget. Den forrige koden er nå ugyldig.", { exact: true })).toBeVisible();
  const rotatedInEditor = await payload.findByID({ collection: "households", id: household.id });
  assert.equal(rotatedInEditor.credentialVersion, 2, "Code replacement is immediate and independent of Save");
  assert.notEqual(await adminPage.locator("output[aria-label='Husstandskode']").textContent(), receipt.accessCode);
  await expect(adminPage.locator(".household-editor-heading")).not.toContainText("Ikke lagret");

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
  console.log("PASS: browser registration, member-derived approval/rejection, save-only member controls, native status isolation, QR/link, private credentials, concurrent retries, code recovery/rotation, CAS, audit rollback, throttling and mobile layout.");
} catch (error) {
  console.error(error);
  exitCode = 1;
} finally {
  await browser?.close();
}
process.exit(exitCode);
