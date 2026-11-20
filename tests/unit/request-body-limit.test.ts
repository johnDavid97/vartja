import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";

import { describe, expect, it, vi } from "vitest";

import {
  MAX_PAYLOAD_JSON_BYTES,
  MAX_PAYLOAD_UPLOAD_BYTES,
  withPayloadBodyLimit,
} from "../../features/request-security/body-limit";

type Context = { params: Promise<{ slug?: string[] }> };

const context = (slug: string[] = ["posts"]): Context => ({ params: Promise.resolve({ slug }) });

function request(
  body: BodyInit | null,
  {
    headers,
    method = "POST",
    signal,
  }: { headers?: HeadersInit; method?: string; signal?: AbortSignal } = {},
): Request {
  return new Request("https://example.test/api/posts?draft=true", {
    body,
    // Node requires duplex for stream request bodies; it is intentionally not needed by the replay.
    ...(body instanceof ReadableStream ? { duplex: "half" } : {}),
    headers,
    method,
    signal,
  } as RequestInit);
}

function chunked(chunks: Uint8Array[], cancel?: () => void): ReadableStream<Uint8Array> {
  return new ReadableStream({
    cancel,
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });
}

async function jsonError(response: Response): Promise<{ error: string }> {
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.has("access-control-allow-origin")).toBe(false);
  return response.json() as Promise<{ error: string }>;
}

describe("Payload REST request body limits", () => {
  it("exports the approved aggregate byte budgets", () => {
    expect(MAX_PAYLOAD_JSON_BYTES).toBe(1_048_576);
    expect(MAX_PAYLOAD_UPLOAD_BYTES).toBe(12_582_912);
  });

  it("counts UTF-8 bytes exactly and accepts the boundary", async () => {
    const native = vi.fn(async (req: Request) => new Response(await req.text()));
    const handler = withPayloadBodyLimit(native);
    const exact = "é".repeat(MAX_PAYLOAD_JSON_BYTES / 2);

    const accepted = await handler(request(exact, { headers: { "content-type": "application/json" } }), context());
    expect(accepted.status).toBe(200);
    expect(await accepted.text()).toBe(exact);
    expect(native).toHaveBeenCalledOnce();

    native.mockClear();
    const rejected = await handler(request(`${exact}é`), context());
    expect(rejected.status).toBe(413);
    expect(await jsonError(rejected)).toEqual({
      error: "Forespørselen er for stor.", errors: [{ message: "Forespørselen er for stor." }],
    });
    expect(native).not.toHaveBeenCalled();
  });

  it("handles many one-byte chunks without retaining a buffer or interruption reaction per chunk", async () => {
    let remaining = 32_768;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (remaining-- > 0) controller.enqueue(new Uint8Array([97]));
        else controller.close();
      },
    });
    const handler = withPayloadBodyLimit(async (req) => new Response(await req.arrayBuffer()));
    const response = await handler(request(stream), context());
    expect(await response.text()).toBe("a".repeat(32_768));
  });

  it("rejects a million tiny chunks within a constrained heap", () => {
    const source = new URL("../../features/request-security/body-limit.ts", import.meta.url).href;
    const script = `
      import { withPayloadBodyLimit, MAX_PAYLOAD_JSON_BYTES } from ${JSON.stringify(source)};
      let remaining = MAX_PAYLOAD_JSON_BYTES + 1;
      let calls = 0;
      const body = new ReadableStream({ pull(c) {
        if (remaining-- > 0) c.enqueue(new Uint8Array([120])); else c.close();
      }});
      const req = new Request('http://localhost/api/posts', { method: 'POST', body, duplex: 'half' });
      const result = await withPayloadBodyLimit(async () => { calls++; return new Response(); })(
        req, { params: Promise.resolve({ slug: ['posts'] }) });
      process.exitCode = result.status === 413 && calls === 0 ? 0 : 1;
    `;
    const result = spawnSync(process.execPath, ["--max-old-space-size=64", "--import", "tsx", "--input-type=module", "-e", script], {
      timeout: 25_000, maxBuffer: 64 * 1024,
    });
    expect(result.status, "Tiny chunks must not exhaust the heap or bypass the limit").toBe(0);
  }, 30_000);

  it("enforces the deadline even when empty ready chunks starve the timer queue", async () => {
    const cancel = vi.fn(() => new Promise<void>(() => undefined));
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) { controller.enqueue(new Uint8Array(0)); }, cancel,
    });
    const native = vi.fn(async () => new Response("must not run"));
    const response = await withPayloadBodyLimit(native, { jsonTimeoutMs: 5 })(request(stream), context());
    expect(response.status).toBe(408);
    expect(cancel).toHaveBeenCalledOnce();
    expect(stream.locked).toBe(false);
    expect(native).not.toHaveBeenCalled();
  });

  it("counts chunked bodies rather than trusting an absent or lying Content-Length", async () => {
    const native = vi.fn(async () => new Response("native"));
    const handler = withPayloadBodyLimit(native);
    const oversized = [new Uint8Array(MAX_PAYLOAD_JSON_BYTES), new Uint8Array([1])];

    expect((await handler(request(chunked(oversized)), context())).status).toBe(413);
    expect((await handler(request(chunked(oversized), { headers: { "content-length": "1" } }), context())).status).toBe(413);
    expect(native).not.toHaveBeenCalled();
  });

  it("uses 12 MiB only for canonical multipart media writes and counts multipart overhead", async () => {
    const native = vi.fn(async () => new Response("ok"));
    const handler = withPayloadBodyLimit(native);
    const multipart = { "content-type": "multipart/form-data; boundary=test" };
    const aboveDefault = new Uint8Array(MAX_PAYLOAD_JSON_BYTES + 1);

    expect((await handler(request(aboveDefault, { headers: multipart }), context(["media"]))).status).toBe(200);
    expect((await handler(request(aboveDefault, { headers: multipart, method: "PATCH" }), context(["media", "42"]))).status).toBe(200);
    expect((await handler(request(aboveDefault, { headers: multipart, method: "PUT" }), context(["media", "42"]))).status).toBe(200);
    expect((await handler(request(aboveDefault, { headers: { "content-type": "multipart/form-data-invalid" } }), context(["media"]))).status).toBe(413);
    expect((await handler(request(aboveDefault, { headers: multipart }), context(["posts"]))).status).toBe(413);
    expect((await handler(request(aboveDefault, { headers: multipart }), context(["%6dedia"]))).status).toBe(413);
    expect((await handler(request(aboveDefault, { headers: multipart }), context(["media", "42", "extra"]))).status).toBe(413);
    expect((await handler(request(aboveDefault, { headers: multipart, method: "DELETE" }), context(["media"]))).status).toBe(413);

    const aggregateTooLarge = chunked([
      new Uint8Array(MAX_PAYLOAD_UPLOAD_BYTES),
      new Uint8Array([1]),
    ]);
    expect((await handler(request(aggregateTooLarge, { headers: multipart }), context(["media"]))).status).toBe(413);
  });

  it("replays the complete body and preserves request and route context", async () => {
    const routeContext = context(["posts", "abc"]);
    const bytes = new TextEncoder().encode("æøå-and-binary-\u0000");
    const native = vi.fn(async (req: Request, receivedContext: Context) => {
      expect(receivedContext).toBe(routeContext);
      expect(req.url).toBe("https://example.test/api/posts?draft=true");
      expect(req.method).toBe("PATCH");
      expect(req.headers.get("cookie")).toBe("session=secret");
      expect(req.headers.get("origin")).toBe("https://admin.example.test");
      expect(req.headers.get("x-extra")).toBe("kept");
      expect(req.signal.aborted).toBe(original.signal.aborted);
      expect(new Uint8Array(await req.arrayBuffer())).toEqual(bytes);
      return new Response("ok");
    });
    const handler = withPayloadBodyLimit(native);
    const original = request(chunked([bytes.subarray(0, 4), bytes.subarray(4)]), {
      method: "PATCH",
      headers: {
        cookie: "session=secret",
        origin: "https://admin.example.test",
        "x-extra": "kept",
      },
    });

    expect((await handler(original, routeContext)).status).toBe(200);
    expect(native).toHaveBeenCalledOnce();
  });

  it("buffers POST method overrides before Payload can consume them", async () => {
    const native = vi.fn(async (req: Request) => new Response(await req.text()));
    const handler = withPayloadBodyLimit(native);
    const req = request("where%5Bid%5D=1", {
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "x-payload-http-method-override": "GET",
      },
    });

    const response = await handler(req, context());
    expect(await response.text()).toBe("where%5Bid%5D=1");
    expect(native).toHaveBeenCalledOnce();
  });

  it("rejects unsupported encodings and invalid or excessive declared lengths early", async () => {
    const native = vi.fn(async () => new Response("bad"));
    const handler = withPayloadBodyLimit(native);

    const encoded = await handler(request("small", { headers: { "content-encoding": "gzip" } }), context());
    expect(encoded.status).toBe(415);
    await jsonError(encoded);

    for (const value of ["-1", "+1", "1.5", "1, 1", "not-a-number"] as const) {
      const response = await handler(request("x", { headers: { "content-length": value } }), context());
      expect(response.status).toBe(400);
      await jsonError(response);
    }

    const declared = await handler(
      request("x", { headers: { "content-length": String(MAX_PAYLOAD_JSON_BYTES + 1) } }),
      context(),
    );
    expect(declared.status).toBe(413);
    expect(native).not.toHaveBeenCalled();
  });

  it("returns 400 for transport read failures without calling Payload", async () => {
    const native = vi.fn(async () => new Response("bad"));
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.error(new Error("private transport detail"));
      },
    });

    const response = await withPayloadBodyLimit(native)(request(stream), context());
    expect(response.status).toBe(400);
    expect(await response.text()).not.toContain("private transport detail");
    expect(native).not.toHaveBeenCalled();
  });

  it("returns 408 and cancels without awaiting a hanging cancel on timeout", async () => {
    let cancelled = false;
    const stream = new ReadableStream<Uint8Array>({
      cancel() {
        cancelled = true;
        return new Promise<void>(() => undefined);
      },
    });
    const native = vi.fn(async () => new Response("bad"));
    const response = await withPayloadBodyLimit(native, { jsonTimeoutMs: 5 })(request(stream), context());

    expect(response.status).toBe(408);
    expect(cancelled).toBe(true);
    expect(native).not.toHaveBeenCalled();
  });

  it("returns 408 and cancels a pending body when the client aborts", async () => {
    let cancelled = false;
    const abortController = new AbortController();
    const stream = new ReadableStream<Uint8Array>({ cancel: () => { cancelled = true; } });
    const native = vi.fn(async () => new Response("bad"));
    const pending = withPayloadBodyLimit(native)(
      request(stream, { signal: abortController.signal }),
      context(),
    );
    abortController.abort();

    expect((await pending).status).toBe(408);
    expect(cancelled).toBe(true);
    expect(native).not.toHaveBeenCalled();
  });

  it("cancels on measured overflow and never invokes Payload", async () => {
    let cancelled = false;
    const stream = new ReadableStream<Uint8Array>({
      cancel() { cancelled = true; },
      pull(controller) {
        controller.enqueue(new Uint8Array(MAX_PAYLOAD_JSON_BYTES + 1));
      },
    });
    const native = vi.fn(async () => new Response("bad"));

    expect((await withPayloadBodyLimit(native)(request(stream), context())).status).toBe(413);
    expect(cancelled).toBe(true);
    expect(native).not.toHaveBeenCalled();
  });

  it("does not convert exceptions from the native Payload handler into body errors", async () => {
    const controlFlow = new Error("native control flow");
    const handler = withPayloadBodyLimit(async () => { throw controlFlow; });
    await expect(handler(request("{}"), context())).rejects.toBe(controlFlow);
  });

  it("leaves GET and OPTIONS behavior outside the limiter and keeps route GET cache policy", async () => {
    const seen: Request[] = [];
    const native = vi.fn(async (req: Request, ctx: Context) => {
      expect(ctx).toBe(routeContext);
      seen.push(req);
      return new Response("native");
    });
    const routeContext = context();
    const original = request(null, { method: "GET" });
    expect((await withPayloadBodyLimit(native)(original, routeContext)).status).toBe(200);

    const options = request(null, { method: "OPTIONS" });
    expect((await withPayloadBodyLimit(native)(options, routeContext)).status).toBe(200);
    expect(seen).toEqual([original, options]);

    const routeSource = await readFile("app/(payload)/api/[...slug]/route.ts", "utf8");
    expect(routeSource).toContain('response.headers.set("Cache-Control", "private, no-store")');
    expect(routeSource).toContain("export const OPTIONS = REST_OPTIONS(config)");
  });
});
