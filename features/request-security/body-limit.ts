export const MAX_PAYLOAD_JSON_BYTES = 1 * 1024 * 1024;
export const MAX_PAYLOAD_UPLOAD_BYTES = 12 * 1024 * 1024;

const JSON_BODY_TIMEOUT_MS = 30_000;
const MEDIA_BODY_TIMEOUT_MS = 120_000;
const BODY_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"]);
const MEDIA_BODY_METHODS = new Set(["POST", "PATCH", "PUT"]);

type PayloadRouteContext = {
  params: Promise<{ slug?: string[] }>;
};

type PayloadHandler = (request: Request, context: PayloadRouteContext) => Promise<Response>;

type LimitOptions = {
  /** Test seam; production callers must use the defaults. */
  jsonTimeoutMs?: number;
  /** Test seam; production callers must use the defaults. */
  mediaTimeoutMs?: number;
};

type ReadFailure = "aborted" | "failed" | "overflow" | "timeout";

type ReadResult =
  | { bytes: Uint8Array }
  | { failure: ReadFailure };

function errorResponse(status: number, error: string): Response {
  return Response.json(
    { error, errors: [{ message: error }] },
    {
      status,
      headers: { "Cache-Control": "private, no-store" },
    },
  );
}

function cancelReader(reader: ReadableStreamDefaultReader<Uint8Array>, reason: string): void {
  try {
    // Cancellation closes the stream immediately, but the transport promise can hang.
    // Consume its rejection without waiting on it to release our reader.
    void reader.cancel(reason).catch(() => undefined);
  } catch {
    // Best-effort cancellation must not prevent an error response.
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // Best effort only: this path is already rejecting the request.
    }
  }
}

function cancelUnreadBody(request: Request, reason: string): void {
  if (!request.body || request.body.locked) return;
  try {
    cancelReader(request.body.getReader(), reason);
  } catch {
    // The response must not depend on a potentially broken transport's cleanup.
  }
}

function hasSupportedContentEncoding(value: string | null): boolean {
  if (value === null) return true;
  const codings = value.split(",").map((coding) => coding.trim().toLowerCase());
  return codings.length > 0 && codings.every((coding) => coding === "identity");
}

function parseContentLength(value: string | null): bigint | null | "invalid" {
  if (value === null) return null;
  if (!/^[0-9]+$/.test(value)) return "invalid";
  try {
    return BigInt(value);
  } catch {
    return "invalid";
  }
}

function isCanonicalMediaUpload(request: Request, slug: string[] | undefined): boolean {
  if (!MEDIA_BODY_METHODS.has(request.method.toUpperCase())) return false;
  const mediaType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (mediaType !== "multipart/form-data") return false;

  // Next supplies decoded catch-all segments. Payload's native adapter routes those same
  // segments after separately encodeURIComponent-encoding each one.
  return Boolean(slug && slug[0] === "media" && (slug.length === 1 || slug.length === 2));
}

async function readBoundedBody(
  request: Request,
  maximumBytes: number,
  timeoutMs: number,
): Promise<ReadResult> {
  if (!request.body) {
    return request.signal.aborted ? { failure: "aborted" } : { bytes: new Uint8Array() };
  }

  let reader: ReadableStreamDefaultReader<Uint8Array>;
  try {
    reader = request.body.getReader();
  } catch {
    return { failure: "failed" };
  }
  let stopped = false;
  let accepted = false;
  let interrupt: (result: ReadResult) => void = () => undefined;
  const interruption = new Promise<ReadResult>((resolve) => { interrupt = resolve; });
  const abort = () => { stopped = true; interrupt({ failure: "aborted" }); };
  const deadline = performance.now() + timeoutMs;
  const timer = setTimeout(() => { stopped = true; interrupt({ failure: "timeout" }); }, timeoutMs);
  request.signal.addEventListener("abort", abort, { once: true });

  // One growing buffer, not one retained object per chunk. One-byte chunks must not
  // multiply memory usage. Race interruption once, not once per read: otherwise each
  // chunk would retain another promise reaction until the deadline.
  const read = async (): Promise<ReadResult> => {
    let bytes = new Uint8Array(0);
    let total = 0;
    try {
      while (!stopped) {
        if (request.signal.aborted) return { failure: "aborted" };
        // Enforce time even when immediately ready chunks starve timer callbacks.
        if (performance.now() >= deadline) return { failure: "timeout" };
        const result = await reader.read();
        if (stopped || request.signal.aborted) return { failure: "aborted" };
        if (result.done) return { bytes: bytes.subarray(0, total) };
        if (!(result.value instanceof Uint8Array)) return { failure: "failed" };
        if (result.value.byteLength > maximumBytes - total) return { failure: "overflow" };
        const required = total + result.value.byteLength;
        if (required > bytes.byteLength) {
          const capacity = Math.min(maximumBytes, Math.max(required, bytes.byteLength * 2, 4096));
          const larger = new Uint8Array(capacity);
          larger.set(bytes.subarray(0, total));
          bytes = larger;
        }
        bytes.set(result.value, total);
        total = required;
      }
      return { failure: "aborted" };
    } catch {
      return { failure: request.signal.aborted ? "aborted" : "failed" };
    }
  };

  try {
    const result = await Promise.race([read(), interruption]);
    accepted = "bytes" in result;
    return result;
  } finally {
    stopped = true;
    clearTimeout(timer);
    request.signal.removeEventListener("abort", abort);
    if (!accepted) cancelReader(reader, "request body rejected");
    else reader.releaseLock();
  }
}

function replayRequest(request: Request, bytes: Uint8Array): Request {
  const body = bytes.buffer instanceof ArrayBuffer
    ? bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
    : new Uint8Array(bytes).buffer;
  return new Request(request.url, {
    body: request.body === null ? undefined : body,
    cache: request.cache,
    credentials: request.credentials,
    headers: request.headers,
    integrity: request.integrity,
    keepalive: request.keepalive,
    method: request.method,
    mode: request.mode,
    redirect: request.redirect,
    referrer: request.referrer,
    referrerPolicy: request.referrerPolicy,
    signal: request.signal,
  });
}

/**
 * Fully buffers and validates a bounded body before allowing Payload to authenticate,
 * parse multipart data, run validation, or mutate state.
 */
export function withPayloadBodyLimit(handler: PayloadHandler, options: LimitOptions = {}): PayloadHandler {
  return async (request, context) => {
    if (!BODY_METHODS.has(request.method.toUpperCase())) return handler(request, context);

    const { slug } = await context.params;
    const mediaUpload = isCanonicalMediaUpload(request, slug);
    const maximumBytes = mediaUpload ? MAX_PAYLOAD_UPLOAD_BYTES : MAX_PAYLOAD_JSON_BYTES;
    const timeoutMs = mediaUpload
      ? options.mediaTimeoutMs ?? MEDIA_BODY_TIMEOUT_MS
      : options.jsonTimeoutMs ?? JSON_BODY_TIMEOUT_MS;

    if (!hasSupportedContentEncoding(request.headers.get("content-encoding"))) {
      cancelUnreadBody(request, "unsupported content encoding");
      return errorResponse(415, "Komprimert forespørselsinnhold støttes ikke.");
    }

    const contentLength = parseContentLength(request.headers.get("content-length"));
    if (contentLength === "invalid") {
      cancelUnreadBody(request, "invalid content length");
      return errorResponse(400, "Ugyldig Content-Length.");
    }
    if (contentLength !== null && contentLength > BigInt(maximumBytes)) {
      cancelUnreadBody(request, "request body too large");
      return errorResponse(413, "Forespørselen er for stor.");
    }

    const result = await readBoundedBody(request, maximumBytes, timeoutMs);
    if ("failure" in result) {
      if (result.failure === "overflow") return errorResponse(413, "Forespørselen er for stor.");
      if (result.failure === "aborted" || result.failure === "timeout") {
        return errorResponse(408, "Forespørselen ble avbrutt eller tok for lang tid.");
      }
      return errorResponse(400, "Kunne ikke lese forespørselen.");
    }

    return handler(replayRequest(request, result.bytes), context);
  };
}
