import type { Metadata } from "next";
import type { WeddingBranding } from "./branding";
import { weddingPath } from "./paths";

/** Encode text, never interpolate configured names as SVG markup. */
export function monogramIconSvg(monogram: string): string {
  const text = monogram.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;",
  })[character]!);
  const fontSize = Array.from(monogram).length > 3 ? 20 : 26;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#2e5e53"/><text x="32" y="41" text-anchor="middle" font-family="Arial, sans-serif" font-weight="700" font-size="${fontSize}" fill="#fff">${text}</text></svg>`;
}

export function weddingIcons(branding: WeddingBranding): Metadata["icons"] {
  return { icon: [{ url: `${weddingPath("/brand-icon")}?v=${encodeURIComponent(branding.monogram)}`, type: "image/svg+xml", sizes: "any" }] };
}

export const vartjaIcons: Metadata["icons"] = {
  icon: [{ url: "/vartja-icon.svg", type: "image/svg+xml", sizes: "any" }],
};
