export type ThemeMode = "light" | "dark";

export const THEME_STORAGE_KEY = "hotelwebapp_theme_v1";
export const ACCENT_STORAGE_KEY = "hotelwebapp_accent_v1";

export function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

export function hexToRgbTuple(hex: string): [number, number, number] | null {
  const raw = hex.trim().replace("#", "");
  if (![3, 6].includes(raw.length)) return null;
  const normalized =
    raw.length === 3
      ? raw
          .split("")
          .map((c) => c + c)
          .join("")
      : raw;
  const num = Number.parseInt(normalized, 16);
  if (Number.isNaN(num)) return null;
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return [r, g, b];
}

