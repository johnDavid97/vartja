import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { chromium, expect, type Browser, type BrowserContext } from "@playwright/test";
import { getPayload, type CollectionBeforeValidateHook } from "payload";
import { sql } from "@payloadcms/db-postgres";
import sharp from "sharp";
import config from "../../payload.config";
import { getHouseholdAdminServices, getHouseholdRegistrationServices } from "../../features/households/composition-root";
import { HOUSEHOLD_SESSION_COOKIE } from "../../features/households/http/session-cookie";
import { weddingPath } from "../../features/wedding-site/paths";

const databaseUrl = new URL(process.env.DATABASE_URL || "");
assert(["localhost", "127.0.0.1"].includes(databaseUrl.hostname));
assert(/^\/sammen_household_(login|members)_test_\d+_[a-f0-9]+$/.test(databaseUrl.pathname), "Disposable login DB only");
const baseURL = process.env.TEST_BASE_URL || "http://localhost:3107";
const payload = await getPayload({ config });
let browser: Browser | undefined;
const mediaIds: number[] = [];
let exitCode = 0;
try {
  const email = `login-test-${randomBytes(6).toString("hex")}@example.invalid`;
  const password = randomBytes(24).toString("hex");
  const adminUser = await payload.create({ collection: "users", data: { email, password, name: "Login test" } });
  const creation = getHouseholdAdminServices(payload);
  const credentials = getHouseholdRegistrationServices(payload);
  const initial = { contactName: "Aud Hansen", displayName: "Aud og Erik", email: "aud@example.invalid", additionalMembers: [{ name: "Erik Hansen" }] };
  const first = await creation.create({ ...initial, requestKey: randomUUID() }, adminUser.id);
  const second = await creation.create({ ...initial, requestKey: randomUUID() }, adminUser.id);
  const firstCode = await credentials.codes.reveal(first.householdId, adminUser.id);
  const secondCode = await credentials.codes.reveal(second.householdId, adminUser.id);
  browser = await chromium.launch();
  const anonymous = await browser.newContext({ baseURL, viewport: { width: 1440, height: 1000 } });
  const guest = await browser.newContext({ baseURL, viewport: { width: 1440, height: 1000 } });
  const otherDevice = await browser.newContext({ baseURL });
  const admin = await browser.newContext({ baseURL });
  const headers = { Origin: baseURL };
  assert((await admin.request.post("/api/users/login", { headers, data: { email, password } })).ok());
  async function login(context: BrowserContext, accessCode = firstCode, householdName = initial.displayName, remember = true) {
    return context.request.post("/api/household-login", { headers, data: { householdName, accessCode, remember } });
  }
  async function session(context: BrowserContext) { return (await (await context.request.get("/api/household-session")).json()).household; }
  async function setMemberStatuses(householdId: number, statuses: readonly ("pending" | "approved" | "revoked")[]) {
    const current = await payload.findByID({ collection: "households", id: householdId });
    assert.equal(statuses.length, current.members.length);
    return payload.update({
      collection: "households",
      id: householdId,
      data: { members: current.members.map((member, index) => ({ ...member, status: statuses[index] })) },
    });
  }
  const image = await sharp({ create: { width: 80, height: 60, channels: 3, background: "#3c6555" } }).png().toBuffer();
  async function upload(name: string) {
    const media = await payload.create({ collection: "media", data: { alt: name }, file: { data: image, name: `${name}-${randomUUID()}.png`, mimetype: "image/png", size: image.length } });
    mediaIds.push(media.id); return media;
  }
  const publicImage = await upload("Public hero");
  const privateImage = await upload("Guest image");
  await payload.updateGlobal({ slug: "wedding", data: { heroBackgroundMode: "image", heroImage: publicImage.id, welcomeMessage: "Public welcome" } });
  const post = await payload.create({ collection: "posts", data: { title: "Guest-only celebration details", description: "Secret guest description", photo: privateImage.id, visibility: "public", _status: "published" } });
  const privatePost = await payload.create({ collection: "posts", data: { title: "Administrator secret", description: "Never for guests", visibility: "private", _status: "published" } });
  await payload.updateGlobal({ slug: "program", data: { _status: "published", itinerary: { days: [{ id: "day", label: "Wedding day", date: "2027-07-27", items: [{ id: "event", kind: "info", title: "Guest-only meeting place", time: "", endTime: "", location: "", destination: "", notes: "" }] }] } } });
  const page = await anonymous.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(weddingPath());
  await expect(page.getByText("Public welcome")).toBeVisible();
  await expect(page.getByText(post.title)).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Program", exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Logg inn", exact: true }).first()).toBeVisible();
  for (const path of [weddingPath("/news"), weddingPath(`/news/${post.id}`), weddingPath("/program"), weddingPath("/bilder")]) {
    const response = await anonymous.request.get(path);
    const text = await response.text();
    assert(!text.includes(post.title) && !text.includes("Guest-only meeting place"), `No SSR/RSC leak at ${path}`);
    await page.goto(path); await expect(page).toHaveURL(/\/andrea-og-martin\/login$/);
  }
  assert.equal((await anonymous.request.get("/api/posts")).status(), 403);
  assert.equal((await anonymous.request.get(`/api/posts/${post.id}`)).status(), 403);
  assert.equal((await anonymous.request.get("/api/globals/program?draft=true")).status(), 403);
  assert((await anonymous.request.get(publicImage.url!)).ok());
  assert.equal((await anonymous.request.get(privateImage.url!)).status(), 403);
  assert(!(await anonymous.request.get(`/_next/image?url=${encodeURIComponent(privateImage.url!)}&w=640&q=75`)).ok());
  const wrongName = await login(guest, firstCode, "Unknown family");
  const wrongCode = await login(guest, "XXXX-XXXX-XXXX-XXXX-XXXX-XXXX");
  assert.equal(wrongName.status(), 401); assert.equal(wrongCode.status(), 401);
  assert.deepEqual(await wrongName.json(), await wrongCode.json());
  assert.equal((await guest.request.post("/api/household-login", { headers: { Origin: "https://evil.invalid" }, data: {} })).status(), 403);
  await page.goto(weddingPath("/login"));
  await expect(page.getByRole("heading", { name: "Logg inn" })).toBeVisible();
  await expect(page.getByLabel("Husstandsnavn", { exact: true })).toBeVisible();
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 950 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: `/tmp/sammen-household-login-${width}.png`, fullPage: true });
  }
  await page.getByLabel("Husstandsnavn", { exact: true }).fill(" aud OG erik ");
  await page.getByLabel("Husstandskode", { exact: true }).fill(firstCode.toLowerCase().replaceAll("-", " "));
  await page.getByRole("button", { name: "Vis kode", exact: true }).click();
  await expect(page.getByLabel("Husstandskode", { exact: true })).toHaveAttribute("type", "text");
  await page.getByRole("button", { name: "Logg inn", exact: true }).click();
  await expect(page).toHaveURL(baseURL + weddingPath());
  await expect(page.getByText(post.title)).toBeVisible();
  const cookie = (await anonymous.cookies()).find((item) => item.name === HOUSEHOLD_SESSION_COOKIE);
  assert(cookie?.httpOnly && cookie.sameSite === "Lax");
  assert(cookie.expires - Date.now() / 1000 > 300 * 86400);
  assert(!(await page.evaluate(() => document.cookie)).includes(cookie.value));
  assert.equal(await page.evaluate(() => localStorage.length), 0);
  assert.equal((await session(anonymous)).householdId, first.householdId);
  assert((await login(guest)).ok());
  assert((await login(otherDevice, secondCode)).ok());
  assert.equal((await session(otherDevice)).householdId, second.householdId, "Same name, different code chooses the correct household");
  assert((await guest.request.get(privateImage.url!)).ok());
  assert.match((await guest.request.get(privateImage.url!)).headers()["cache-control"], /no-store/);
  assert(!(await guest.request.get(`/api/posts/${privatePost.id}`)).ok());
  assert.equal((await guest.request.get("/api/households")).status(), 403);
  assert.equal((await guest.request.get("/api/household-sessions")).status(), 403);
  assert.equal((await admin.request.get("/api/household-sessions", { headers })).status(), 403);
  await page.goto(weddingPath("/program")); await expect(page.getByText("Guest-only meeting place")).toBeVisible();
  const savedState = await guest.storageState();
  const remembered = await browser.newContext({ baseURL, storageState: savedState });
  assert.equal((await session(remembered)).householdId, first.householdId);

  await payload.update({ collection: "households", id: first.householdId, data: { displayName: "Familien Hansen" } });
  assert.equal((await session(guest)).displayName, "Familien Hansen", "Rename keeps existing sessions");
  assert.equal((await login(guest)).status(), 401, "Old name no longer logs in");
  assert((await login(guest, firstCode, "familien HANSEN", false)).ok());
  assert.equal((await guest.cookies()).find((item) => item.name === HOUSEHOLD_SESSION_COOKIE)?.expires, -1);
  const pendingResponse = await otherDevice.request.post("/api/household-registration", { headers, data: { ...initial, displayName: "Venterfamilien", requestKey: randomUUID(), invitationKey: credentials.invitation.getKey() } });
  assert.equal(pendingResponse.status(), 201, await pendingResponse.text());
  const pending = await pendingResponse.json();
  assert((await login(otherDevice, pending.accessCode, "Venterfamilien")).ok());
  const pendingPage = await otherDevice.newPage();
  await pendingPage.goto(weddingPath("/program")); await expect(pendingPage).toHaveURL(/\/andrea-og-martin\/waiting$/);
  await expect(pendingPage.getByRole("heading", { name: "Venter på godkjenning" })).toBeVisible();
  for (const width of [1440, 390, 320]) {
    await pendingPage.setViewportSize({ width, height: 950 });
    assert(await pendingPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await pendingPage.screenshot({ path: `/tmp/sammen-household-waiting-${width}.png`, fullPage: true });
  }
  assert.equal((await otherDevice.request.get(privateImage.url!)).status(), 403);
  assert.equal((await otherDevice.request.get("/api/posts")).status(), 403);
  const pendingBeforeApproval = await payload.findByID({ collection: "households", id: pending.householdId });
  const approvedPendingHousehold = await setMemberStatuses(pending.householdId, pendingBeforeApproval.members.map(() => "approved"));
  assert.equal(approvedPendingHousehold.status, "approved");
  await pendingPage.getByRole("button", { name: "Sjekk godkjenning" }).click(); await expect(pendingPage).toHaveURL(baseURL + weddingPath());
  assert((await otherDevice.request.get("/api/posts")).ok());

  // Hold a native edit after originalDoc is read. Rotation must wait on the same row lock.
  let releaseEdit!: () => void;
  let enteredEdit!: () => void;
  const held = new Promise<void>((resolve) => { releaseEdit = resolve; });
  const entered = new Promise<void>((resolve) => { enteredEdit = resolve; });
  const barrier: CollectionBeforeValidateHook = async ({ data, context }) => {
    if (context.loginRaceProbe) { enteredEdit(); await held; }
    return data;
  };
  const hooks = payload.collections.households.config.hooks.beforeValidate!;
  hooks.push(barrier);
  const edit = payload.update({ collection: "households", id: first.householdId, context: { loginRaceProbe: true }, data: { email: "renamed@example.invalid" } });
  await entered;
  let rotationFinished = false;
  const rotation = credentials.codes.rotate(first.householdId, adminUser.id).then((code) => { rotationFinished = true; return code; });
  await new Promise((resolve) => setTimeout(resolve, 80));
  const waitedForEdit = !rotationFinished;
  releaseEdit();
  const [, rotated] = await Promise.all([edit, rotation]);
  hooks.splice(hooks.indexOf(barrier), 1);
  assert(waitedForEdit, "Rotation and native edits must serialize to prevent old credentials being restored");
  assert.equal(await session(guest), null); assert.equal(await session(remembered), null); assert.equal(await session(anonymous), null);
  assert.equal((await guest.request.get(privateImage.url!)).status(), 403);
  assert.equal((await login(guest, firstCode, "Familien Hansen")).status(), 401);
  assert((await login(guest, rotated, "Familien Hansen")).ok());
  assert((await login(remembered, rotated, "Familien Hansen")).ok());
  const beforeMemberRejection = await payload.findByID({ collection: "households", id: first.householdId });
  assert.equal(beforeMemberRejection.members.length, 2);
  const partiallyRejected = await setMemberStatuses(first.householdId, ["revoked", "approved"]);
  assert.equal(partiallyRejected.status, "approved");
  assert.equal((await session(guest)).householdId, first.householdId);
  assert.equal((await session(remembered)).householdId, first.householdId, "Another-device approved session must remain valid while another member is approved");
  const fullyRejected = await setMemberStatuses(first.householdId, ["revoked", "revoked"]);
  assert.equal(fullyRejected.status, "revoked");
  assert.equal(await session(guest), null);
  assert.equal(await session(remembered), null);
  assert.equal((await login(guest, rotated, "Familien Hansen")).status(), 401);
  const reapprovedAfterRejection = await setMemberStatuses(first.householdId, ["approved", "revoked"]);
  assert.equal(reapprovedAfterRejection.status, "approved");
  assert.equal(await session(guest), null, "A rejected household session must remain revoked after later member approval");
  assert.equal(await session(remembered), null, "Reapproval must not resurrect another device's revoked session");
  assert((await login(guest, rotated, "Familien Hansen")).ok());
  const pendingMembers = await setMemberStatuses(first.householdId, ["pending", "pending"]);
  assert.equal(pendingMembers.status, "pending");
  assert.equal(await session(guest), null, "Removing the last approval revokes existing sessions");
  const approvedAgain = await setMemberStatuses(first.householdId, ["approved", "pending"]);
  assert.equal(approvedAgain.status, "approved");
  assert((await login(guest, rotated, "Familien Hansen")).ok());
  const staleCookie = (await guest.cookies()).find((item) => item.name === HOUSEHOLD_SESSION_COOKIE)!;
  assert.equal((await guest.request.post("/api/household-logout", { headers: { Origin: "https://evil.invalid" }, data: {} })).status(), 403);
  assert((await guest.request.post("/api/household-logout", { headers, data: {} })).ok());
  await guest.addCookies([staleCookie]); assert.equal(await session(guest), null, "Logout revokes server-side token");
  assert((await login(guest, rotated, "Familien Hansen")).ok());
  await payload.db.drizzle.execute(sql`UPDATE household_sessions SET expires_at = now() - interval '1 second' WHERE household_id = ${first.householdId}`);
  assert.equal(await session(guest), null);
  assert((await login(guest, rotated, "Familien Hansen")).ok());
  await payload.delete({ collection: "households", id: first.householdId });
  assert.equal(await session(guest), null, "Deleting household denies its sessions");
  await payload.updateGlobal({ slug: "wedding", data: { heroBackgroundMode: "color" } });
  assert.equal((await guest.request.get(publicImage.url!)).status(), 403, "Old homepage photo is no longer public");
  for (let index = 0; index < 20; index++) assert.equal((await login(guest, secondCode, "Wrong name for quota")).status(), 401);
  assert.equal((await login(guest, secondCode, "Wrong name for quota")).status(), 429);
  assert.equal((await guest.request.get("/api/household-login-limits")).status(), 403);
  assert.deepEqual(errors, []);
  console.log("PASS: family name/code login, duplicate names, cookies, remembered devices, member-derived pending/approval/rejection, session retention/revocation, rename, rotation/logout/expiry/deletion, durable quota, protected pages/APIs/media, public hero and mobile login.");
} catch (error) { console.error(error); exitCode = 1; }
finally {
  await browser?.close();
  for (const id of mediaIds) await payload.delete({ collection: "media", id }).catch(() => undefined);
  await payload.destroy();
  process.exit(exitCode);
}
