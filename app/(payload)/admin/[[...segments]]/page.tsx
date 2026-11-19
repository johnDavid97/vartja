import type { Metadata } from "next";
import { connection } from "next/server";
import config from "@payload-config";
import { RootPage } from "@payloadcms/next/views";
import { weddingPageMetadata } from "@/features/wedding-site/branding-server";
import { importMap } from "../importMap";

type Props = {
  params: Promise<{ segments: string[] }>;
  searchParams: Promise<{ [key: string]: string | string[] }>;
};

// The authenticated CMS is request-rendered, not an instant-navigation page.
export const instant = false;

const collectionLabels = new Map([
  ["households", "Husstander"],
  ["users", "Administratorer"],
  ["posts", "Innlegg"],
  ["media", "Bilder"],
  ["program-comments", "Kommentarer"],
  ["poll-votes", "Avstemninger"],
  ["program-poll-votes", "Avstemninger"],
]);

const globalLabels = new Map([
  ["program", "Program"],
  ["wedding", "Innstillinger"],
]);

const pageLabels = new Map([
  ["account", "Konto"],
  ["create-first-user", "Opprett administrator"],
  ["forgot", "Glemt passord"],
  ["login", "Logg inn"],
  ["logout", "Logg ut"],
  ["logout-inactivity", "Logg inn"],
  ["polls", "Avstemninger"],
  ["reset", "Tilbakestill passord"],
  ["unauthorized", "Ingen tilgang"],
]);

function adminPageLabel(segments: string[] | undefined): string {
  const [section, slug] = segments ?? [];

  if (!section) return "Administrasjon";
  if (section === "collections" && slug) return collectionLabels.get(slug) ?? "Administrasjon";
  if (section === "globals" && slug) return globalLabels.get(slug) ?? "Administrasjon";

  return pageLabels.get(section) ?? "Administrasjon";
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { segments } = await params;

  return {
    ...await weddingPageMetadata(adminPageLabel(segments)),
    robots: { index: false, follow: false },
  };
}

export default async function AdminPage({ params, searchParams }: Props) {
  // Payload's editor uses the current date; render it only for a real request.
  await connection();
  return RootPage({ config, params, searchParams, importMap });
}
