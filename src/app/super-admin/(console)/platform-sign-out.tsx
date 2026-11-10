"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";

export default function PlatformSignOut() {
  const [busy, setBusy] = useState(false);

  async function signOut() {
    setBusy(true);
    try {
      await fetch("/api/super-admin/logout", { method: "POST" });
    } finally {
      window.location.href = "/super-admin/login";
    }
  }

  return (
    <button
      type="button"
      onClick={signOut}
      disabled={busy}
      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-700 px-3 text-[11px] font-semibold text-slate-300 transition hover:border-slate-500 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-400 disabled:opacity-60"
    >
      <LogOut size={14} aria-hidden="true" />
      {busy ? "Signing out…" : "Sign out"}
    </button>
  );
}
