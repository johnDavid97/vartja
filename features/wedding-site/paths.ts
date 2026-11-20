/** One active wedding, not a tenant selector. Keep in sync with the explicit app route folders. */
export const WEDDING_BASE_PATH = "/andrea-og-martin" as const;

/** Website pages only: Payload admin, media and application APIs retain their root paths. */
export function weddingPath(path: `/${string}` = "/"): string {
  return path === "/" ? WEDDING_BASE_PATH : `${WEDDING_BASE_PATH}${path}`;
}

/** Explicit compatibility aliases; never redirect arbitrary slugs to this wedding. */
export function weddingRedirects() {
  return [
    // Convenience alias only, not tenant-scoped administration. Keep reversible.
    { source: weddingPath("/admin/:path*"), destination: "/admin/:path*", permanent: false },
    ...(["/news", "/program", "/bilder", "/login", "/waiting", "/register"] as const).map((path) => ({
      source: path,
      destination: weddingPath(path),
      permanent: true,
    })),
    { source: "/news/:id", destination: weddingPath("/news/:id"), permanent: true },
    { source: "/tidsplan", destination: weddingPath("/news"), permanent: true },
  ];
}
