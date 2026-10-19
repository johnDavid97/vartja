import type { Metadata } from "next";
import config from "@payload-config";
import { RootPage } from "@payloadcms/next/views";
import { importMap } from "../importMap";

type Props = {
  params: Promise<{ segments: string[] }>;
  searchParams: Promise<{ [key: string]: string | string[] }>;
};

export const metadata: Metadata = {
  title: "Admin — Andrea & Martin",
  robots: { index: false, follow: false },
};

export default function AdminPage({ params, searchParams }: Props) {
  return RootPage({ config, params, searchParams, importMap });
}
