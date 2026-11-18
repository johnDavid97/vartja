import { DEFAULT_HERO_COLOR } from "./settings";
import { isHexColor } from "@/lib/colors";

/** Choose actual black/white, guaranteeing at least WCAG AA normal-text contrast. */
export function heroTextColor(color: string): "#000000" | "#ffffff" {
  const background = isHexColor(color) ? color : DEFAULT_HERO_COLOR;
  const channels = [1, 3, 5].map((offset) => Number.parseInt(background.slice(offset, offset + 2), 16) / 255)
    .map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  const luminance = 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  return (luminance + 0.05) / 0.05 > 1.05 / (luminance + 0.05) ? "#000000" : "#ffffff";
}
