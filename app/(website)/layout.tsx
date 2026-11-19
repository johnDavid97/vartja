import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { geistSans, geistMono, weddingSerif } from "@/app/fonts";
import { getWeddingBranding } from "@/features/wedding-site/branding-server";
import { weddingIcons } from "@/features/wedding-site/icons";
import "./globals.css";
import Header from "@/components/Header";
import { getWebsiteViewer } from "@/features/households/auth/server";

export async function generateMetadata(): Promise<Metadata> {
  const branding = await getWeddingBranding();
  return {
    title: branding.names,
    icons: weddingIcons(branding),
    description: "Informasjon om bryllupet vårt – program, reise og feiring.",
  };
}

async function WeddingHeader() {
  await connection();
  const [branding, viewer] = await Promise.all([getWeddingBranding(), getWebsiteViewer()]);
  const access = viewer.administrator ? "administrator" : viewer.household?.status ?? "anonymous";
  return <Header names={branding.names} access={access} />;
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="nb"
      className={`${geistSans.variable} ${geistMono.variable} ${weddingSerif.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#fdfcf9] text-stone-800">
        <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-white focus:px-4 focus:py-3 focus:text-[#2e5e53] focus:shadow">Hopp til innhold</a>
        <Suspense fallback={<div className="h-20 shrink-0" aria-hidden="true" />}>
          <WeddingHeader />
        </Suspense>
        <div id="main-content" tabIndex={-1} className="min-w-0 flex-1 outline-none">{children}</div>
      </body>
    </html>
  );
}
