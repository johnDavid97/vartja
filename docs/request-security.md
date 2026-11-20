# Payload REST request security

## Native body limits

The native Payload REST route buffers and validates every `POST`, `PATCH`, `PUT`, and `DELETE` body before invoking Payload. Payload therefore cannot authenticate, parse multipart data, validate, run hooks, or mutate data until the complete body has passed the limit.

Limits apply to actual bytes received, regardless of a missing, understated, or chunked `Content-Length`:

- **1 MiB aggregate** (`1 * 1024 * 1024` bytes) for all normal request bodies. This is also the limit for multipart bodies outside the narrowly allowed upload routes.
- **12 MiB aggregate** (`12 * 1024 * 1024` bytes) only for `multipart/form-data` sent with `POST`, `PATCH`, or `PUT` to `/api/media` or `/api/media/<id>`. The aggregate includes multipart fields, boundaries, headers, and other overhead.

Payload's existing **10 MiB per-file limit is unchanged**. The 12 MiB request allowance is not a larger file allowance; it leaves room for multipart overhead around a valid file.

The media decision uses Next's decoded `ctx.params.slug` catch-all segments, the same segments that the installed `@payloadcms/next` REST adapter individually encodes before native Payload routing. It does not classify from a separately decoded URL string. Only segments resolving to that media route receive the larger budget; differently encoded segments, extra path segments, non-multipart requests, and `DELETE` cannot use it to reach another endpoint.

A valid `Content-Length` above the applicable limit is rejected early, but the stream is still counted when the declaration is absent or smaller than reality. Invalid lengths return `400`. Non-identity `Content-Encoding` returns `415`; these native clients do not need compressed request bodies. Receipt has a 30-second deadline for normal bodies and a 120-second deadline for canonical media multipart bodies. Client aborts and receipt timeouts return `408`, read failures return `400`, and oversized bodies return `413`.

The receiver uses one growing byte buffer and one interruption race, rather than retaining an object and pending promise reaction per chunk. A monotonic deadline also stops immediately ready empty chunks from starving timer callbacks. This limits receipt memory even with tiny chunks; downstream parsing still needs additional bounded allocations.

Limit errors contain only fixed Norwegian JSON messages (including Payload-compatible `errors` for native forms), use `Cache-Control: private, no-store`, do not log request data, and do not add permissive CORS headers. The incoming reader is cancelled on overflow, abort, or timeout without waiting for a transport cancellation promise that could hang. Accepted bytes are replayed in a new plain Web `Request`, preserving the URL and query, method, headers (including cookies and Origin), signal semantics, and the original Next route context. This matches Payload's documented plain-`Request` REST handler type. `POST` method-override requests are buffered before Payload processes the override.

`GET` remains delegated to the native handler with its existing private/no-store and `Vary: Cookie` policy. Native `OPTIONS`, authentication, authorization, validation, CORS, editor behavior, and session behavior remain unchanged for accepted requests and normal responses. Exceptions from the native handler are not converted to body errors.

## Source assumptions checked

Implementation was checked against the installed Next.js 16 route-handler documentation and the installed Payload 3.94 REST adapter, `handleEndpoints`, `createPayloadRequest`, method-override handling, and multipart/body buffering paths. The route uses standard Fetch `Request`/`Response` APIs and does not depend on `NextRequest` extensions.

## Verification

After `npm run build`, run `npm run test:request-security`. Its guarded disposable database suite exercises real HTTP early/streamed rejection, a slow incomplete request, method override, native authentication/CSRF, rich-text saves and image creation/replacement. It checks the 12 MiB aggregate and unchanged 10 MiB per-file limits without touching real content. Unit tests additionally exercise cancellation, exact UTF-8 byte boundaries, replay, and a million one-byte chunks in a subprocess constrained to a 64 MiB JavaScript heap.

Existing non-Payload guest routes retain their own smaller JSON limits. These changes do not replace ingress protection or impose new voting identity rules.

## Legacy poll write-rate protection

Legacy post polls allow at most 20 new ballot attempts per database-clock minute per approved household, across those polls. The owner is derived from the authenticated server session, not the browser voter cookie or submitted IDs. Clearing the voter cookie does not reset this counter. Existing ballots, counts and browser-based voting identity remain unchanged; persisted retries do not consume another slot, and trusted native administrators are exempt.

The atomic counter uses the existing internal quota table with a separate HMAC namespace, preserving Program/comment counters. No schema migration is needed. Storage failure returns a generic 503 before ballot creation; saturation returns 429 with `Retry-After: 60`. Concurrent or failed new attempts may consume slots; this is rate limiting, not exactly-once accounting or a lifetime ballot cap. See [polls](../features/polls/README.md) and run `npm run test:post-poll-rate-limit` after a build.

## Still required at ingress

These application limits bound one native Payload REST body. Production ingress must still provide independent global controls, including request rate limits, concurrent connection/request limits, header and URL limits, slow-client protection, and suitable infrastructure-wide body limits. Those controls should cover all routes and reject abusive traffic before it consumes application workers.

Native administrator account lockout remains enabled. Source-based protection must use a verified ingress identity: arbitrary `Forwarded` or `X-Forwarded-For` headers are not trustworthy, and a shared global login counter would let one caller block every administrator. This source-throttling boundary still needs deployment verification; rate limiting alone also cannot guarantee prevention of targeted account lockout.

No cloud, reverse-proxy, database, schema, or deployment configuration was applied as part of this change.
