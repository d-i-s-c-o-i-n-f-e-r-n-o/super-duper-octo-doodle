import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { ACCENT_STORAGE_KEY, THEME_STORAGE_KEY, hexToRgbTuple, ThemeMode } from "../lib/theme";

type ThemeContextValue = {
  mode: ThemeMode;
  accent: string;
  fontSize: "small" | "medium" | "large" | "auto";
  setMode: (mode: ThemeMode) => void;
  setAccent: (hex: string) => void;
  setFontSize: (v: "small" | "medium" | "large" | "auto") => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyThemeToDom(mode: ThemeMode) {
  document.body.dataset.theme = mode;
}

function applyAccentToDom(accentHex: string) {
  const rgb = hexToRgbTuple(accentHex);
  if (!rgb) return;
  const [r, g, b] = rgb;
  document.documentElement.style.setProperty("--accent", accentHex);
  document.documentElement.style.setProperty("--accent-rgb", `${r}, ${g}, ${b}`);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>("light");
  const [accent, setAccent] = useState<string>("#2a7fff");
  const [fontSize, setFontSize] = useState<"small" | "medium" | "large" | "auto">("medium");

  useEffect(() => {
    try {
      const savedMode = localStorage.getItem(THEME_STORAGE_KEY);
      const savedAccent = localStorage.getItem(ACCENT_STORAGE_KEY);
      const savedFont = localStorage.getItem("hotelwebapp_fontsize_v1");
      if (savedMode === "light" || savedMode === "dark") setMode(savedMode);
      if (typeof savedAccent === "string" && savedAccent.trim().length >= 4) setAccent(savedAccent);
      if (savedFont === "small" || savedFont === "medium" || savedFont === "large" || savedFont === "auto") setFontSize(savedFont);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    applyThemeToDom(mode);
  }, [mode]);

  useEffect(() => {
    applyAccentToDom(accent);
  }, [accent]);

  useEffect(() => {
    document.body.dataset.font = fontSize;
    try {
      localStorage.setItem("hotelwebapp_fontsize_v1", fontSize);
    } catch {}
  }, [fontSize]);

  const value = useMemo(
    () => ({
      mode,
      accent,
      fontSize,
      setMode: (m: ThemeMode) => {
        setMode(m);
        try {
          localStorage.setItem(THEME_STORAGE_KEY, m);
        } catch {}
      },
      setAccent: (hex: string) => {
        setAccent(hex);
        try {
          localStorage.setItem(ACCENT_STORAGE_KEY, hex);
        } catch {}
      },
      setFontSize: (v: "small" | "medium" | "large" | "auto") => {
        setFontSize(v);
      },
    }),
    [mode, accent, fontSize],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}

