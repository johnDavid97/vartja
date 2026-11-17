import type { Metadata } from "next";
import { geistSans, geistMono } from "@/app/fonts";
import "./globals.css";
import Header from "@/components/Header";

export const metadata: Metadata = {
  title: "Bryllupet vårt",
  description: "Informasjon om bryllupet vårt – program, reise og feiring.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="nb"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-stone-50 text-stone-800">
        <Header />
        {children}
      </body>
    </html>
  );
}
