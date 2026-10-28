"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

export default function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const enabled = document.documentElement.dataset.theme === "dark";
    document.body.dataset.themeReady = "true";
    setDark(enabled);
  }, []);
  function toggle() {
    const enabled = !dark;
    document.documentElement.dataset.theme = enabled ? "dark" : "light";
    localStorage.setItem("mary-theme", enabled ? "dark" : "light");
    setDark(enabled);
  }
  return <button type="button" onClick={toggle} aria-label={`Switch to ${dark ? "light" : "dark"} mode`} aria-pressed={dark} title={`Switch to ${dark ? "light" : "dark"} mode`} className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 ${compact ? "h-11 w-11 min-h-11 p-0" : ""}`}>{dark ? <Sun size={16}/> : <Moon size={16}/>}<span className={compact ? "sr-only" : ""}>{dark ? "Light mode" : "Dark mode"}</span></button>;
}
