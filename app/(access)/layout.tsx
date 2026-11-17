import type { Metadata } from "next"
import type { ReactNode } from "react"
import { geistSans, geistMono } from "@/app/fonts"

import "@/app/(website)/globals.css"

export const metadata: Metadata = {
  title: "Registrer husstanden",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
}

export default function AccessLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="nb" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full bg-stone-50 text-stone-800">
        <main className="min-h-screen w-full overflow-x-hidden px-4 py-8 sm:px-6 sm:py-12">
          <div className="mx-auto flex w-full max-w-3xl justify-center">{children}</div>
        </main>
      </body>
    </html>
  )
}
