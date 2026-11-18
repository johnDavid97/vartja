import type { PayloadRequest, Where } from "payload";
import { getHouseholdAuthServices } from "./composition-root";
import type { HouseholdSession } from "./models";
import { sessionTokenFromHeaders } from "../http/session-cookie";

const sessions = new WeakMap<PayloadRequest, Promise<HouseholdSession | null>>();

/** Request-local deduplication only. Approval and credential versions are checked again on every request. */
export function householdSessionForRequest(req: PayloadRequest): Promise<HouseholdSession | null> {
  const token = sessionTokenFromHeaders(req.headers);
  if (!token) return Promise.resolve(null);
  let session = sessions.get(req);
  if (!session) {
    session = getHouseholdAuthServices(req.payload).resolve(token);
    sessions.set(req, session);
  }
  return session;
}

export async function canReadGuestContent({ req }: { req: PayloadRequest }): Promise<boolean> {
  if (req.user?.collection === "users") return true;
  return (await householdSessionForRequest(req))?.status === "approved";
}

export const publishedGuestPosts: Where = {
  and: [
    { _status: { equals: "published" } },
    { or: [{ visibility: { equals: "public" } }, { visibility: { exists: false } }] },
  ],
};

export async function readPostsAccess({ req }: { req: PayloadRequest }): Promise<boolean | Where> {
  if (req.user?.collection === "users") return true;
  return await canReadGuestContent({ req }) ? publishedGuestPosts : false;
}

/** The selected homepage photo is the sole public CMS media exception. */
export async function readMediaAccess({ req }: { req: PayloadRequest }): Promise<boolean | Where> {
  if (await canReadGuestContent({ req })) return true;
  const wedding = await req.payload.findGlobal({
    slug: "wedding", depth: 0, overrideAccess: true, req,
    select: { heroImage: true, heroBackgroundMode: true },
  });
  if (wedding.heroBackgroundMode !== "image") return false;
  const imageId = typeof wedding.heroImage === "number" ? wedding.heroImage : wedding.heroImage?.id;
  return imageId ? { id: { equals: imageId } } : false;
}
