import config from "@payload-config";
import {
  REST_DELETE,
  REST_GET,
  REST_OPTIONS,
  REST_PATCH,
  REST_POST,
  REST_PUT,
} from "@payloadcms/next/routes";

const payloadGet = REST_GET(config);
export async function GET(...args: Parameters<typeof payloadGet>) {
  const response = await payloadGet(...args);
  // Reads can now depend on household cookies, including uploaded image bytes.
  response.headers.set("Cache-Control", "private, no-store");
  const vary = response.headers.get("Vary");
  response.headers.set("Vary", vary ? `${vary}, Cookie` : "Cookie");
  return response;
}
export const POST = REST_POST(config);
export const DELETE = REST_DELETE(config);
export const PATCH = REST_PATCH(config);
export const PUT = REST_PUT(config);
export const OPTIONS = REST_OPTIONS(config);
