"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronRight, Search, Eye, LogOut } from "lucide-react";
import { ThemeStyleControls } from "@/components/design-system/theme-provider";
import { CommandPalette } from "@/components/design-system/command-palette";
import { useTenant } from "@/components/tenant-provider";

interface DashboardHeaderProps {
  user: {
    id: string;
    name: string;
    role: string;
    avatarUrl?: string | null;
  };
  roleTitle: string;
}

export function DashboardHeader({ user, roleTitle }: DashboardHeaderProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const tenant = useTenant();

  return (
    <>
      <header className="sticky top-0 z-20 flex h-[72px] items-center justify-between border-b border-slate-200/70 bg-white/90 px-4 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/90 sm:px-7 lg:px-10">
        {/* Mobile brand & Desktop Breadcrumb */}
        <div className="flex items-center gap-3 lg:hidden">
          <Image src={tenant.logoUrl || "/mary-royal-logo.png"} alt={tenant.name} width={36} height={36} className="rounded-lg object-contain" />
          <span className="font-extrabold tracking-tight text-slate-900 dark:text-white truncate max-w-[140px]">{tenant.name}</span>
        </div>

        <div className="hidden items-center gap-2 text-xs text-slate-400 dark:text-slate-500 lg:flex">
          <span className="font-semibold text-slate-600 dark:text-slate-400">{tenant.name}</span>
          <ChevronRight size={14} />
          <span className="font-bold text-slate-800 dark:text-slate-200">{roleTitle} workspace</span>
        </div>

        {/* Global Search Button + Theme Controls + User Profile */}
        <div className="flex items-center gap-2 sm:gap-3.5">
          {/* Quick Search Shortcut Trigger */}
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            aria-label="Open search palette (Ctrl+K)"
            className="flex items-center gap-2 rounded-xl border border-slate-200/80 bg-slate-50/70 px-3 py-1.5 text-xs font-semibold text-slate-500 transition hover:border-blue-300 hover:bg-blue-50/50 hover:text-blue-700 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-400 dark:hover:text-blue-300"
          >
            <Search size={14} className="text-slate-400" />
            <span className="hidden sm:inline">Search...</span>
            <kbd className="hidden rounded bg-slate-200/60 px-1.5 py-0.5 text-[10px] font-bold text-slate-500 dark:bg-slate-700 dark:text-slate-400 sm:inline-block">
              Ctrl+K
            </kbd>
          </button>

          <ThemeStyleControls compact />

          {user.role === "DIRECTOR" && (
            <Link
              href="/audit"
              aria-label="Security activity"
              title="Security activity"
              className="grid h-9 w-9 place-items-center rounded-xl text-blue-800 transition hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-blue-950"
            >
              <Eye size={17} />
            </Link>
          )}

          <div className="hidden text-right sm:block">
            <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{user.name}</p>
            <p className="mt-0.5 text-[10px] font-medium text-slate-500 dark:text-slate-400">{roleTitle}</p>
          </div>

          <Link
            href="/profile"
            aria-label="Open profile and security settings"
            className="relative grid h-9 w-9 place-items-center overflow-hidden rounded-full bg-blue-100 text-xs font-bold text-blue-800 ring-1 ring-blue-200 dark:bg-blue-950 dark:text-blue-200 dark:ring-blue-800"
          >
            {user.avatarUrl ? (
              <Image src={user.avatarUrl} alt="" fill sizes="36px" className="object-cover" unoptimized />
            ) : (
              user.name
                .split(/\s+/)
                .map((part) => part[0])
                .slice(0, 2)
                .join("")
                .toUpperCase()
            )}
          </Link>

          <form action="/api/logout" method="post">
            <button
              aria-label="Sign out"
              title="Sign out"
              className="grid h-9 w-9 place-items-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-blue-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
            >
              <LogOut size={17} />
            </button>
          </form>
        </div>
      </header>

      {/* Global Command Palette */}
      <CommandPalette isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
