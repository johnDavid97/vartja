// This suite may mutate only the fresh database created by request-security-isolated.ts.
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { rm } from "node:fs/promises";
import { createConnection, type Socket } from "node:net";
import path from "node:path";
import { getPayload } from "payload";
import sharp from "sharp";
import config from "../../payload.config";
import { bootstrapAdministrator } from "../../features/admin-security/bootstrap";

const MIB = 1024 * 1024;
const SMALL_BODY_LIMIT = MIB;
const MEDIA_BODY_LIMIT = 12 * MIB;
const REQUEST_TIMEOUT_MS = 20_000;
const baseURL = process.env.TEST_BASE_URL || "http://localhost:3121";
const databaseURL = new URL(process.env.DATABASE_URL || "");
assert(["localhost", "127.0.0.1"].includes(databaseURL.hostname), "Local databases only");
assert(
  /^\/sammen_request_security_test_\d+_[a-f0-9]+$/.test(databaseURL.pathname),
  "Fresh request-security database only",
);
assert.equal(new URL(baseURL).origin, "http://localhost:3121", "Expected the dedicated loopback server");

const payload = await getPayload({ config });
const runID = randomBytes(8).toString("hex");
const email = `request-security-${runID}@example.invalid`;
const password = `Request-${randomBytes(24).toString("base64url")}`;
const mediaPrefix = `request-security-${runID}`;
const writtenMediaNames = new Set<string>();
let mediaID: number | string | undefined;
let exitCode = 0;

function timeoutSignal(): AbortSignal {
  return AbortSignal.timeout(REQUEST_TIMEOUT_MS);
}

async function request(url: string, init: RequestInit = {}): Promise<Response> {
  return fetch(url, { ...init, signal: init.signal || timeoutSignal() });
}

function cookiePair(setCookie: string): string {
  const pair = setCookie.split(";", 1)[0] || "";
  assert(/^[^=]+=.+$/.test(pair), "Native login must set a non-empty authentication cookie");
  return pair;
}

function oversizedJSON(extraBytes = 64): string {
  const body = JSON.stringify({ padding: "x".repeat(SMALL_BODY_LIMIT + extraBytes) });
  assert(Buffer.byteLength(body) > SMALL_BODY_LIMIT);
  return body;
}

function lexicalBody(text: string) {
  return {
    root: {
      children: [{
        children: [{ detail: 0, format: 0, mode: "normal", style: "", text, type: "text", version: 1 }],
        direction: "ltr",
        format: "",
        indent: 0,
        textFormat: 0,
        textStyle: "",
        type: "paragraph",
        version: 1,
      }],
      direction: "ltr",
      format: "",
      indent: 0,
      type: "root",
      version: 1,
    },
  };
}

async function postCount(): Promise<number> {
  return (await payload.count({ collection: "posts", overrideAccess: true })).totalDocs;
}

async function mediaCount(): Promise<number> {
  return (await payload.count({ collection: "media", overrideAccess: true })).totalDocs;
}

function assertPrivateVary(response: Response, label: string): void {
  assert.match(response.headers.get("cache-control") || "", /(?:^|,)\s*private\b/i, `${label} must remain private`);
  assert.match(response.headers.get("cache-control") || "", /\bno-store\b/i, `${label} must remain no-store`);
  const vary = (response.headers.get("vary") || "").split(",").map((value) => value.trim().toLowerCase());
  assert(vary.includes("cookie"), `${label} must vary on Cookie`);
}

function rawStatus(
  writeRequest: (socket: Socket) => void,
  timeoutMs = REQUEST_TIMEOUT_MS,
): Promise<number> {
  return new Promise((resolve, reject) => {
    const socket = createConnection({ host: "127.0.0.1", port: 3121 });
    let settled = false;
    let response = "";
    const timer = setTimeout(() => finish(new Error("Raw HTTP request exceeded its test timeout")), timeoutMs);

    const finish = (error?: Error, status?: number) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.destroy();
      if (error) reject(error);
      else resolve(status!);
    };

    socket.once("connect", () => {
      try {
        writeRequest(socket);
      } catch (error) {
        finish(error instanceof Error ? error : new Error("Raw HTTP write failed"));
      }
    });
    socket.on("data", (chunk) => {
      response += chunk.toString("latin1");
      const match = /^HTTP\/1\.[01] (\d{3})\b/.exec(response);
      if (match) finish(undefined, Number(match[1]));
    });
    socket.once("error", (error) => finish(error));
    socket.once("end", () => {
      if (!settled) finish(new Error("Raw HTTP peer closed without a status line"));
    });
  });
}

function rawHead(pathname: string, headers: readonly string[]): string {
  return [`POST ${pathname} HTTP/1.1`, "Host: localhost:3121", "Connection: close", ...headers, "", ""].join("\r\n");
}

function multipartMedia(data: Buffer, filename: string, alt: string): FormData {
  const form = new FormData();
  form.set("_payload", JSON.stringify({ alt }));
  form.set("file", new Blob([new Uint8Array(data)], { type: "image/png" }), filename);
  return form;
}

async function removeOwnedMediaFiles(): Promise<void> {
  await Promise.all([...writtenMediaNames].map((filename) => {
    assert(filename.startsWith(mediaPrefix), "Cleanup is restricted to this suite's media names");
    return rm(path.resolve("media", filename), { force: true });
  }));
}

try {
  assert.deepEqual(payload.config.csrf, [baseURL], "Payload must trust exactly the configured local origin");
  assert.equal((await payload.count({ collection: "users", overrideAccess: true })).totalDocs, 0);
  assert.equal(await postCount(), 0);
  assert.equal(await mediaCount(), 0);

  await bootstrapAdministrator(payload, { name: "Request security administrator", email, password });
  assert.equal((await payload.count({ collection: "users", overrideAccess: true })).totalDocs, 1);

  const oversizedUnauthenticatedLogin = await request(`${baseURL}/api/users/login`, {
    method: "POST",
    headers: { "content-type": "application/json", Origin: baseURL },
    body: oversizedJSON(),
  });
  assert.equal(oversizedUnauthenticatedLogin.status, 413);
  const oversizedUnauthenticatedAdministratorCreate = await request(`${baseURL}/api/users`, {
    method: "POST",
    headers: { "content-type": "application/json", Origin: baseURL },
    body: oversizedJSON(),
  });
  assert.equal(oversizedUnauthenticatedAdministratorCreate.status, 413);
  assert.equal((await payload.count({ collection: "users", overrideAccess: true })).totalDocs, 1);

  const oversizedUnauthenticatedPost = await request(`${baseURL}/api/posts`, {
    method: "POST",
    headers: { "content-type": "application/json", Origin: baseURL },
    body: oversizedJSON(),
  });
  assert.equal(oversizedUnauthenticatedPost.status, 413);
  assert.equal(await postCount(), 0);

  const ordinaryUnauthenticatedPost = await request(`${baseURL}/api/posts`, {
    method: "POST",
    headers: { "content-type": "application/json", Origin: baseURL },
    body: JSON.stringify({ title: "Must remain unauthorized", description: "No write" }),
  });
  assert.equal(ordinaryUnauthenticatedPost.status, 403, "Native Payload authorization must still own ordinary requests");
  assert.equal(await postCount(), 0);

  const login = await request(`${baseURL}/api/users/login`, {
    method: "POST",
    headers: { "content-type": "application/json", Origin: baseURL },
    body: JSON.stringify({ email, password }),
  });
  assert.equal(login.status, 200, "Native login from the configured origin must succeed");
  const loginResult = await login.json() as { token?: string };
  assert.equal(typeof loginResult.token === "string" && loginResult.token.length > 20, true, "Native login must return a JWT");
  const jwt = loginResult.token!;
  const cookie = cookiePair(login.headers.get("set-cookie") || "");
  const authenticatedHeaders = { Cookie: cookie, Origin: baseURL };

  const oversizedAdministratorCreate = await request(`${baseURL}/api/users`, {
    method: "POST",
    headers: { ...authenticatedHeaders, "content-type": "application/json" },
    body: oversizedJSON(),
  });
  assert.equal(oversizedAdministratorCreate.status, 413);
  assert.equal((await payload.count({ collection: "users", overrideAccess: true })).totalDocs, 1);

  const earlyStartedAt = Date.now();
  const earlyStatus = await rawStatus((socket) => {
    socket.write(rawHead("/api/posts", [
      "Content-Type: application/json",
      `Content-Length: ${SMALL_BODY_LIMIT + 1}`,
      `Origin: ${baseURL}`,
    ]));
    // Deliberately send no body: rejection must come from Content-Length alone.
  }, 5_000);
  assert.equal(earlyStatus, 413);
  assert(Date.now() - earlyStartedAt < 4_000, "Declared oversize must be rejected before waiting for its body");

  const chunkedStatus = await rawStatus((socket) => {
    socket.write(rawHead("/api/posts", ["Content-Type: application/json", "Transfer-Encoding: chunked", `Origin: ${baseURL}`]));
    const chunk = Buffer.alloc(128 * 1024, 0x78);
    for (let index = 0; index < 9; index += 1) {
      if (socket.destroyed) break;
      socket.write(`${chunk.length.toString(16)}\r\n`);
      socket.write(chunk);
      socket.write("\r\n");
    }
    if (!socket.destroyed) socket.write("0\r\n\r\n");
  });
  assert.equal(chunkedStatus, 413, "A chunked body without Content-Length must be counted while streaming");
  assert.equal(await postCount(), 0);

  const malformedLengthStatus = await rawStatus((socket) => {
    socket.end(rawHead("/api/posts", ["Content-Type: application/json", "Content-Length: invalid", `Origin: ${baseURL}`]));
  }, 5_000);
  assert.equal(malformedLengthStatus, 400, "Malformed Content-Length must be rejected as a bad request");

  const incompleteStartedAt = Date.now();
  const incompleteStatus = await rawStatus((socket) => {
    socket.write(rawHead("/api/posts", ["Content-Type: application/json", "Transfer-Encoding: chunked", `Origin: ${baseURL}`]));
    socket.write("1\r\n{\r\n");
    // No terminal chunk: the application must not retain this request indefinitely.
  }, 40_000);
  assert.equal(incompleteStatus, 408, "An incomplete body must hit the bounded request timeout");
  assert(Date.now() - incompleteStartedAt < 35_000, "Body timeout must remain operationally bounded");

  const encoded = await request(`${baseURL}/api/posts`, {
    method: "POST",
    headers: { ...authenticatedHeaders, "content-type": "application/json", "content-encoding": "gzip" },
    body: JSON.stringify({ title: "Encoding bypass", description: "Must not be written" }),
  });
  assert.equal(encoded.status, 415, "Non-identity Content-Encoding must not bypass byte accounting");
  assert.equal(await postCount(), 0);

  const oversizedText = await request(`${baseURL}/api/posts`, {
    method: "POST",
    headers: { ...authenticatedHeaders, "content-type": "text/plain" },
    body: "x".repeat(SMALL_BODY_LIMIT + 1),
  });
  assert.equal(oversizedText.status, 413, "A text/plain body must receive the same byte limit");
  assert.equal(await postCount(), 0);

  const overridden = await request(`${baseURL}/api/posts`, {
    method: "POST",
    headers: {
      ...authenticatedHeaders,
      "content-type": "application/json",
      "X-Payload-HTTP-Method-Override": "GET",
    },
    body: oversizedJSON(),
  });
  assert.equal(overridden.status, 413, "Payload's POST-to-GET override must not skip the request guard");

  const malformedJSON = await request(`${baseURL}/api/posts`, {
    method: "POST",
    headers: { ...authenticatedHeaders, "content-type": "application/json" },
    body: '{"title":',
  });
  assert.equal(malformedJSON.status, 400, "Within-limit malformed JSON must remain a native parsing error");
  const nativeValidation = await request(`${baseURL}/api/posts`, {
    method: "POST",
    headers: { ...authenticatedHeaders, "content-type": "application/json" },
    body: JSON.stringify({ title: "Missing required description" }),
  });
  assert.equal(nativeValidation.status, 400, "Within-limit field validation must remain owned by Payload");
  assert.equal(await postCount(), 0);

  const oversizedMultipartPost = new FormData();
  oversizedMultipartPost.set("_payload", JSON.stringify({
    title: "Oversized multipart fields",
    description: "x".repeat(SMALL_BODY_LIMIT),
  }));
  const multipartPostResponse = await request(`${baseURL}/api/posts`, {
    method: "POST",
    headers: authenticatedHeaders,
    body: oversizedMultipartPost,
  });
  assert.equal(multipartPostResponse.status, 413, "Non-media multipart fields must retain the 1 MiB aggregate limit");
  assert.equal(await postCount(), 0);

  const richText = `preserved-${runID}-` + "ø".repeat(160 * 1024);
  const richPostBody = JSON.stringify({
    title: "Bounded rich-text save",
    description: "A legitimate native REST save",
    visibility: "private",
    _status: "published",
    body: lexicalBody(richText),
  });
  assert(Buffer.byteLength(richPostBody) > 256 * 1024, "Fixture must exceed small authenticated-body thresholds");
  assert(Buffer.byteLength(richPostBody) < SMALL_BODY_LIMIT, "Fixture must remain inside the 1 MiB budget");
  const richPostResponse = await request(`${baseURL}/api/posts`, {
    method: "POST",
    headers: { ...authenticatedHeaders, "content-type": "application/json" },
    body: richPostBody,
  });
  assert.equal(richPostResponse.status, 201, "A valid large native post save must succeed");
  const richPostResult = await richPostResponse.json() as { doc?: { id?: number | string } };
  const postID = richPostResult.doc?.id;
  assert(postID !== undefined, "Native create must return the post ID");
  assert.equal(await postCount(), 1);

  const readPost = await request(`${baseURL}/api/posts/${postID}`, { headers: authenticatedHeaders });
  assert.equal(readPost.status, 200);
  assertPrivateVary(readPost, "Payload REST GET");
  const readPostResult = await readPost.json() as { body?: { root?: { children?: Array<{ children?: Array<{ text?: string }> }> } } };
  assert.equal(readPostResult.body?.root?.children?.[0]?.children?.[0]?.text, richText, "Large rich text must round-trip exactly through the API");

  const forbiddenOrigin = await request(`${baseURL}/api/posts`, {
    method: "POST",
    headers: { Cookie: cookie, Origin: "https://evil.example.invalid", "content-type": "application/json" },
    body: JSON.stringify({ title: "Foreign origin", description: "Must not be created" }),
  });
  assert.equal(forbiddenOrigin.status, 403, "The byte guard must not weaken native CSRF enforcement");
  assert.equal(await postCount(), 1);

  for (const method of ["POST", "PUT", "PATCH", "DELETE"] as const) {
    const target = method === "POST" ? `${baseURL}/api/posts` : `${baseURL}/api/posts/${postID}`;
    const response = await request(target, {
      method,
      headers: { ...authenticatedHeaders, "content-type": "application/json" },
      body: oversizedJSON(method.length),
    });
    assert.equal(response.status, 413, `Oversized ${method} must be rejected`);
  }
  assert.equal(await postCount(), 1, "Rejected body methods must not create or delete posts");
  const unchangedPost = await payload.findByID({ collection: "posts", id: postID, overrideAccess: true, depth: 0 });
  assert.equal(unchangedPost.title, "Bounded rich-text save", "Rejected updates must not alter the post");

  const oversizedMediaJSON = await request(`${baseURL}/api/media`, {
    method: "POST",
    headers: { ...authenticatedHeaders, "content-type": "application/json" },
    body: oversizedJSON(),
  });
  assert.equal(oversizedMediaJSON.status, 413, "The 12 MiB exception must not apply to JSON media requests");
  assert.equal(await mediaCount(), 0);

  const aggregateForm = new FormData();
  aggregateForm.set("_payload", JSON.stringify({ alt: "Aggregate overflow" }));
  const aggregatePartSize = Math.floor(MEDIA_BODY_LIMIT / 2) + 64 * 1024;
  assert(aggregatePartSize < 10 * MIB);
  aggregateForm.append("file", new Blob([new Uint8Array(aggregatePartSize)], { type: "image/png" }), `${mediaPrefix}-aggregate-a.png`);
  aggregateForm.append("file", new Blob([new Uint8Array(aggregatePartSize)], { type: "image/png" }), `${mediaPrefix}-aggregate-b.png`);
  const aggregateResponse = await request(`${baseURL}/api/media`, {
    method: "POST",
    headers: authenticatedHeaders,
    body: aggregateForm,
  });
  assert.equal(aggregateResponse.status, 413, "Media multipart aggregate size must not exceed 12 MiB");
  assert.equal(await mediaCount(), 0);

  const overFileLimitName = `${mediaPrefix}-over-file-limit.png`;
  const overFileLimit = multipartMedia(Buffer.alloc(10 * MIB + 1), overFileLimitName, "Over native file limit");
  const overFileResponse = await request(`${baseURL}/api/media`, {
    method: "POST",
    headers: authenticatedHeaders,
    body: overFileLimit,
  });
  assert.equal(overFileResponse.status, 413, "Payload's existing 10 MiB per-file limit must remain effective below 12 MiB aggregate");
  assert.equal(await mediaCount(), 0);

  const firstImageName = `${mediaPrefix}-created.png`;
  const firstImage = await sharp({ create: { width: 32, height: 24, channels: 3, background: "#587466" } }).png().toBuffer();
  const createMediaResponse = await request(`${baseURL}/api/media`, {
    method: "POST",
    headers: authenticatedHeaders,
    body: multipartMedia(firstImage, firstImageName, "Initial valid request-security image"),
  });
  assert.equal(createMediaResponse.status, 201, "A valid authenticated image upload must succeed");
  const createMediaResult = await createMediaResponse.json() as { doc?: { id?: number | string; filename?: string; url?: string } };
  mediaID = createMediaResult.doc?.id;
  assert(mediaID !== undefined);
  assert(createMediaResult.doc?.filename?.startsWith(mediaPrefix));
  writtenMediaNames.add(createMediaResult.doc!.filename!);
  assert.equal(await mediaCount(), 1);

  const oversizedMediaDelete = new FormData();
  oversizedMediaDelete.set("padding", "x".repeat(SMALL_BODY_LIMIT + 1));
  const oversizedMediaDeleteResponse = await request(`${baseURL}/api/media/${mediaID}`, {
    method: "DELETE",
    headers: authenticatedHeaders,
    body: oversizedMediaDelete,
  });
  assert.equal(oversizedMediaDeleteResponse.status, 413, "Media DELETE must retain the 1 MiB limit");
  assert.equal(await mediaCount(), 1, "Rejected media DELETE must not remove the document");

  const anonymousMedia = await request(`${baseURL}/api/media/${mediaID}`);
  assert.equal(anonymousMedia.status, 403, "Private media metadata must remain inaccessible anonymously");
  const jwtMedia = await request(`${baseURL}/api/media/${mediaID}`, {
    headers: { Authorization: `Bearer ${jwt}`, Origin: baseURL },
  });
  assert.equal(jwtMedia.status, 200, "Native JWT authentication must remain intact");

  const evilImage = await sharp({ create: { width: 12, height: 12, channels: 3, background: "#884455" } }).png().toBuffer();
  const evilOriginMedia = await request(`${baseURL}/api/media/${mediaID}`, {
    method: "PATCH",
    headers: { Cookie: cookie, Origin: "https://evil.example.invalid" },
    body: multipartMedia(evilImage, `${mediaPrefix}-evil.png`, "Foreign origin replacement"),
  });
  assert.equal(evilOriginMedia.status, 403, "Media updates must retain exact-origin CSRF protection");
  assert.equal(await mediaCount(), 1);

  const updatedImageName = `${mediaPrefix}-updated.png`;
  const updatedImage = await sharp({ create: { width: 40, height: 30, channels: 3, background: "#785e70" } }).png().toBuffer();
  const updateMediaResponse = await request(`${baseURL}/api/media/${mediaID}`, {
    method: "PATCH",
    headers: authenticatedHeaders,
    body: multipartMedia(updatedImage, updatedImageName, "Updated valid request-security image"),
  });
  assert.equal(updateMediaResponse.status, 200, "A valid authenticated image replacement must succeed");
  const updateMediaResult = await updateMediaResponse.json() as { doc?: { alt?: string; filename?: string; url?: string } };
  assert.equal(updateMediaResult.doc?.alt, "Updated valid request-security image");
  assert(updateMediaResult.doc?.filename?.startsWith(mediaPrefix));
  writtenMediaNames.add(updateMediaResult.doc!.filename!);
  const mediaURL = new URL(updateMediaResult.doc!.url!, baseURL).toString();
  const mediaBytes = await request(mediaURL, { headers: authenticatedHeaders });
  assert.equal(mediaBytes.status, 200, "Authenticated media bytes must remain readable");
  assert.match(mediaBytes.headers.get("content-type") || "", /^image\/png\b/);
  assertPrivateVary(mediaBytes, "Media file GET");
  assert((await mediaBytes.arrayBuffer()).byteLength > 0);

  const trustedPreflight = await request(`${baseURL}/api/media`, {
    method: "OPTIONS",
    headers: { Origin: baseURL, "Access-Control-Request-Method": "POST" },
  });
  assert.equal(trustedPreflight.headers.get("access-control-allow-origin"), baseURL);
  const evilPreflight = await request(`${baseURL}/api/media`, {
    method: "OPTIONS",
    headers: { Origin: "https://evil.example.invalid", "Access-Control-Request-Method": "POST" },
  });
  assert.notEqual(evilPreflight.headers.get("access-control-allow-origin"), "https://evil.example.invalid");
  assert.notEqual(evilPreflight.headers.get("access-control-allow-origin"), "*");

  console.log("PASS: bounded Payload REST bodies, early and streamed rejection, timeout/encoding defenses, native auth/validation/CSRF, rich-text preservation, media aggregate and per-file limits, valid image replacement, JWT access and private caching.");
} catch (error) {
  console.error(error);
  exitCode = 1;
} finally {
  if (mediaID !== undefined) {
    await payload.delete({ collection: "media", id: mediaID, overrideAccess: true }).catch(() => undefined);
  }
  await removeOwnedMediaFiles().catch(() => undefined);
  await payload.destroy();
}
process.exit(exitCode);
