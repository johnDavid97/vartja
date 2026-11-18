import { Cormorant_Garamond, Geist, Geist_Mono } from "next/font/google";

// Shared by the wedding and invitation layouts so forms use the same typography.
export const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
export const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
export const weddingSerif = Cormorant_Garamond({
  variable: "--font-wedding-serif",
  subsets: ["latin"],
  style: ["normal", "italic"],
  display: "swap",
});
