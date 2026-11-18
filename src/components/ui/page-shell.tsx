"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { HelpCircle, Search, ShieldCheck, Sparkles, UserRound } from "lucide-react";
import NotificationBell from "@/components/notification-bell";
import { ThemeStyleControls } from "@/components/design-system/theme-provider";
import ConfirmLogoutForm from "@/components/confirm-logout-form";
import PageNavigation from "@/components/page-navigation";
import { getRoleNavigation, getSectionForPath } from "@/lib/navigation";
import { PortalHeader } from "@/components/ui/portal-header";
import { PortalNav } from "@/components/ui/portal-nav";
import { ToastProvider } from "@/components/ui/toast";

const LearnerGuide = dynamic(() => import("@/components/learner-guide").then((module) => module.LearnerGuide), { ssr: false });
const CommandPalette = dynamic(() => import("@/components/design-system/command-palette").then((module) => module.CommandPalette), { ssr: false });

type ShellUser = {
  id: string;
  name: string;
  email?: string | null;
  role: string;
  roleLabel: string;
  avatarUrl?: string | null;
};

export function PageShell({
  user,
  hiddenLabels = [],
  children,
}: {
  user: ShellUser;
  hiddenLabels?: string[];
  children: React.ReactNode;
}) {
  const pathname = usePathname() ?? "/";
  const section = getSectionForPath(pathname, user.role);
  const nav = useMemo(
    () => getRoleNavigation(user.role).filter((item) => !hiddenLabels.includes(item.label)),
    [user.role, hiddenLabels],
  );
  const [searchOpen, setSearchOpen] = useState(false);
  const [navBadges, setNavBadges] = useState<{ welfare?: number; pendingComplaints?: number }>({});

  useEffect(() => {
    fetch("/api/nav/badges")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          setNavBadges({
            welfare: data.welfare ?? data.welfareBadge ?? 0,
            pendingComplaints: data.pendingComplaints ?? 0,
          });
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen((open) => !open);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <ToastProvider>
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <div className="app-shell">
        <aside className="app-sidebar" aria-label="Mary Royal School navigation">
          <Link href={user.role === "PARENT" ? "/portal" : user.role === "LEARNER" ? "/learning" : "/dashboard"} className="mb-5 flex items-center gap-2.5 px-2">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-mark-surface p-1">
              <Image src="/mary-royal-logo.png" alt="" width={36} height={36} className="h-full w-full object-contain" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-body font-semibold text-ink">Mary Royal School</span>
              <span className="block text-caption text-ink-3">Obunga · Kisumu</span>
            </span>
          </Link>
          <nav aria-label="Desktop navigation" className="flex flex-col gap-0.5">
            {nav.map(({ label, href, icon: Icon }) => {
              const active = href === "/dashboard" ? pathname === "/dashboard" : pathname === href || pathname.startsWith(`${href}/`);
              const badge = href === "/welfare" ? (navBadges.welfare ?? 0) : href === "/complaints" ? (navBadges.pendingComplaints ?? 0) : 0;
              return (
                <Link key={label} href={href} aria-current={active ? "page" : undefined} className="side-link">
                  <Icon size={17} strokeWidth={1.9} aria-hidden="true" />
                  <span className="truncate">{label}</span>
                  {badge > 0 && (
                    <span className="ml-auto grid h-4 min-w-4 place-items-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white shadow-xs">
                      {badge > 9 ? "9+" : badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
          <div className="mt-5 border-t border-line-soft pt-3">
            <Link href="/assistant" className="side-link">
              <Sparkles size={17} aria-hidden="true" />
              <span>Ask assistant</span>
            </Link>
            <Link href="/help" className="side-link">
              <HelpCircle size={17} aria-hidden="true" />
              <span>Help & guides</span>
            </Link>
            <Link href="/profile" className="side-link">
              <UserRound size={17} aria-hidden="true" />
              <span>Profile & password</span>
            </Link>
            <Link href="/privacy" className="side-link">
              <ShieldCheck size={17} aria-hidden="true" />
              <span>Privacy notice</span>
            </Link>
          </div>
          <div className="mt-auto rounded-xl bg-brand-soft p-3.5">
            <p className="text-label font-semibold text-brand-ink">Hard work pays</p>
            <p className="mt-0.5 text-caption text-brand-ink/80">Nurturing Excellence Through CBE</p>
          </div>
        </aside>

        <div className="app-column">
          <header aria-label="School app bar" className="app-topbar">
            <p className="min-w-0 truncate text-label text-ink-3">
              Mary Royal School <span className="px-1.5 text-ink-3">/</span>
              <span className="font-semibold text-ink">{section}</span>
            </p>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setSearchOpen(true)} className="btn btn-secondary btn-sm">
                <Search size={15} aria-hidden="true" />
                <span>Search</span>
                <kbd className="ml-1 hidden rounded border border-line px-1.5 text-caption text-ink-3 xl:inline">Ctrl K</kbd>
              </button>
              <Link href="/assistant" aria-label="Ask AI" title="Ask AI" className="btn btn-secondary btn-sm">
                <Sparkles size={16} aria-hidden="true" />
                <span className="hidden xl:inline">Ask AI</span>
              </Link>
              <ThemeStyleControls compact />
              <NotificationBell />
              <span className="ml-1 hidden text-right xl:block">
                <span className="block max-w-40 truncate text-label font-semibold text-ink">{user.name}</span>
                <span className="block text-caption text-ink-3">{user.roleLabel}</span>
              </span>
              <details className="relative">
                <summary aria-label="Open profile menu" className="grid h-11 w-11 cursor-pointer list-none place-items-center rounded-full">
                  <span className="grid h-9 w-9 place-items-center overflow-hidden rounded-full bg-brand-soft text-label font-semibold text-brand-ink ring-1 ring-brand-line">
                    {user.avatarUrl ? (
                      <Image src={user.avatarUrl} alt="" width={36} height={36} className="h-9 w-9 object-cover" unoptimized />
                    ) : (
                      user.name
                        .trim()
                        .split(/\s+/)
                        .map((part) => part[0])
                        .slice(0, 2)
                        .join("")
                        .toUpperCase()
                    )}
                  </span>
                </summary>
                <div className="absolute right-0 top-12 z-50 w-60 rounded-xl border border-line bg-surface p-2 text-ink shadow-lg">
                  <div className="px-2 py-1.5">
                    <p className="truncate text-label font-semibold">{user.name}</p>
                    {user.email ? <p className="truncate text-caption text-ink-3">{user.email}</p> : null}
                  </div>
                  <Link href="/assistant" className="side-link">Ask assistant</Link>
                  <Link href="/help" className="side-link">Help & guides</Link>
                  <Link href="/profile" className="side-link">Profile & password</Link>
                  <Link href="/privacy" className="side-link">Privacy notice</Link>
                  <ConfirmLogoutForm className="mt-1 border-t border-line-soft pt-1" buttonClassName="side-link w-full text-danger" />
                </div>
              </details>
            </div>
          </header>

          <PortalHeader user={user} />
          <PageNavigation active={section} homeHref={user.role === "PARENT" ? "/portal" : user.role === "LEARNER" ? "/learning" : "/dashboard"} userId={user.id} />

          <main id="main-content" tabIndex={-1} className="app-main page-main">
            {children}
          </main>
        </div>

        <PortalNav role={user.role} />
        {user.role === "LEARNER" ? <LearnerGuide name={user.name} /> : null}
      </div>
      {searchOpen ? <CommandPalette isOpen onClose={() => setSearchOpen(false)} /> : null}
    </ToastProvider>
  );
}
