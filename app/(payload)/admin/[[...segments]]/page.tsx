import type { Metadata } from "next";
import { connection } from "next/server";
import config from "@payload-config";
import { RootPage } from "@payloadcms/next/views";
import { importMap } from "../importMap";

type Props = {
  params: Promise<{ segments: string[] }>;
  searchParams: Promise<{ [key: string]: string | string[] }>;
};

// The authenticated CMS is request-rendered, not an instant-navigation page.
export const instant = false;

export const metadata: Metadata = {
  title: "Admin — Andrea & Martin",
  robots: { index: false, follow: false },
};

export default async function AdminPage({ params, searchParams }: Props) {
  // Payload's editor uses the current date; render it only for a real request.
  await connection();
  return RootPage({ config, params, searchParams, importMap });
}
