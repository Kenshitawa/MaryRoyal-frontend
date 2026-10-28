"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { Sparkles, LayoutGrid, Sun, Moon } from "lucide-react";

export type UITheme = "light" | "dark" | "system";
export type UIStyle = "bento" | "glass";

interface ThemeContextType {
  theme: UITheme;
  style: UIStyle;
  setTheme: (theme: UITheme) => void;
  setStyle: (style: UIStyle) => void;
  toggleTheme: () => void;
  toggleStyle: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "light",
  style: "bento",
  setTheme: () => {},
  setStyle: () => {},
  toggleTheme: () => {},
  toggleStyle: () => {},
});

export function ThemeProvider({
  children,
  defaultRole
}: {
  children: React.ReactNode;
  defaultRole?: string;
}) {
  const [theme, setThemeState] = useState<UITheme>("light");
  const [style, setStyleState] = useState<UIStyle>(
    defaultRole === "PARENT" || defaultRole === "LEARNER" ? "glass" : "bento"
  );

  useEffect(() => {
    // 1. Initialize Light/Dark
    const savedTheme = localStorage.getItem("mary-theme") as UITheme | null;
    const isDark = savedTheme === "dark" || (savedTheme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    if (isDark) {
      document.documentElement.dataset.theme = "dark";
      setThemeState(savedTheme === "system" ? "system" : "dark");
    } else {
      document.documentElement.dataset.theme = "light";
      setThemeState(savedTheme === "system" ? "system" : "light");
    }

    // 2. Initialize Bento/Glass Style
    const savedStyle = localStorage.getItem("mary-style") as UIStyle | null;
    const initialStyle: UIStyle = savedStyle || (
      defaultRole === "PARENT" || defaultRole === "LEARNER" ? "glass" : "bento"
    );
    document.documentElement.dataset.style = initialStyle;
    setStyleState(initialStyle);
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const updateSystemTheme = () => {
      if (localStorage.getItem("mary-theme") === "system") document.documentElement.dataset.theme = media.matches ? "dark" : "light";
    };
    media.addEventListener("change", updateSystemTheme);
    return () => media.removeEventListener("change", updateSystemTheme);
  }, [defaultRole]);

  const setTheme = (newTheme: UITheme) => {
    const dark = newTheme === "dark" || (newTheme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    localStorage.setItem("mary-theme", newTheme);
    setThemeState(newTheme);
  };

  const setStyle = (newStyle: UIStyle) => {
    document.documentElement.dataset.style = newStyle;
    localStorage.setItem("mary-style", newStyle);
    setStyleState(newStyle);
  };

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  const toggleStyle = () => {
    setStyle(style === "glass" ? "bento" : "glass");
  };

  return (
    <ThemeContext.Provider
      value={{ theme, style, setTheme, setStyle, toggleTheme, toggleStyle }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

export function ThemeStyleControls({ compact = false }: { compact?: boolean }) {
  const { theme, style, toggleTheme, toggleStyle } = useTheme();

  return (
    <div className="flex items-center gap-1.5 rounded-xl border border-slate-200/80 bg-white/90 p-1 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
      <button
        type="button"
        onClick={toggleStyle}
        title={`Switch UI theme (currently ${style === "bento" ? "Bento" : "Glass"})`}
        aria-label={`Switch UI theme (currently ${style === "bento" ? "Bento" : "Glass"})`}
        className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold transition ${
          style === "bento"
            ? "bg-blue-50 text-blue-800 dark:bg-blue-950 dark:text-blue-200"
            : "bg-blue-600 text-white shadow-sm"
        }`}
      >
        {style === "bento" ? <LayoutGrid size={14} /> : <Sparkles size={14} />}
        {!compact && (
          <span className="hidden sm:inline">
            {style === "bento" ? "Bento" : "Glass"}
          </span>
        )}
      </button>

      <div className="h-4 w-px bg-slate-200 dark:bg-slate-800" aria-hidden="true" />

      <button
        type="button"
        onClick={toggleTheme}
        title={`Switch mode (currently ${theme === "dark" ? "Dark" : "Light"})`}
        aria-label={`Switch mode (currently ${theme === "dark" ? "Dark" : "Light"})`}
        className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
      >
        {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
      </button>
    </div>
  );
}
