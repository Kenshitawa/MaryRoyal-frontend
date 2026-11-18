"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { Sparkles, LayoutGrid, Sun, Moon, Monitor } from "lucide-react";
import { IconButton } from "@/components/ui/actions";

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

function applyResolvedTheme(isDark: boolean) {
  const root = document.documentElement;
  root.dataset.theme = isDark ? "dark" : "light";
  root.classList.toggle("dark", isDark);
}

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
    applyResolvedTheme(isDark);
    if (isDark) {
      setThemeState(savedTheme === "system" ? "system" : "dark");
    } else {
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
      if (localStorage.getItem("mary-theme") === "system") applyResolvedTheme(media.matches);
    };
    media.addEventListener("change", updateSystemTheme);
    return () => media.removeEventListener("change", updateSystemTheme);
  }, [defaultRole]);

  const setTheme = (newTheme: UITheme) => {
    const dark = newTheme === "dark" || (newTheme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    applyResolvedTheme(dark);
    localStorage.setItem("mary-theme", newTheme);
    setThemeState(newTheme);
  };

  const setStyle = (newStyle: UIStyle) => {
    document.documentElement.dataset.style = newStyle;
    localStorage.setItem("mary-style", newStyle);
    setStyleState(newStyle);
  };

  // Light → Dark → System → Light. System follows the device preference and
  // is a real third state, not an alias for dark.
  const toggleTheme = () => {
    setTheme(theme === "light" ? "dark" : theme === "dark" ? "system" : "light");
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
  const themeLabel = theme === "dark" ? "Dark" : theme === "system" ? "System" : "Light";
  const ThemeIcon = theme === "dark" ? Moon : theme === "system" ? Monitor : Sun;

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

      <IconButton
        ariaLabel={`Switch mode (currently ${themeLabel})`}
        onClick={toggleTheme}
        title={`Switch mode (currently ${themeLabel})`}
        className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
      >
        <ThemeIcon size={15} />
      </IconButton>
    </div>
  );
}
