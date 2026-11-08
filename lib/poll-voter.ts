import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const COOKIE_NAME = "sammen-poll-voter";
const sign = (value: string, secret: string) => createHmac("sha256", secret).update(value).digest("hex");

export function pollVoter(cookieHeader: string | null, secret: string) {
  const token = cookieHeader?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${COOKIE_NAME}=`))?.slice(COOKIE_NAME.length + 1);
  const [candidate, signature] = token?.split(".") || [];
  const valid = candidate && /^[a-f0-9]{48}$/.test(candidate) && signature && /^[a-f0-9]{64}$/.test(signature)
    && timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(sign(candidate, secret), "hex"));
  const id = valid ? candidate : randomBytes(24).toString("hex");
  return {
    id,
    cookie: valid ? null : `${COOKIE_NAME}=${id}.${sign(id, secret)}; Path=/api/posts; HttpOnly; SameSite=Lax; Max-Age=31536000${process.env.NODE_ENV === "production" ? "; Secure" : ""}`,
  };
}

export function pollVoteKey(postId: number, pollId: string, voter: string, secret: string) {
  return sign(JSON.stringify([postId, pollId, voter]), secret);
}
