"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { MoreHorizontal, Search } from "lucide-react";
import { getMobileNavigation } from "@/lib/navigation";
import { Sheet } from "@/components/ui/sheet";

type Badges = {
  unreadNotifications: number;
  pendingComplaints: number;
  pendingApprovals: number;
  messages: number;
};

export function PortalNav({ role }: { role: string }) {
  const pathname = usePathname() ?? "";
  const [search, setSearch] = useState("");
  const [searchParams, setSearchParams] = useState("");
  const [moreOpen, setMoreOpen] = useState(false);
  const [badges, setBadges] = useState<Badges>({ unreadNotifications: 0, pendingComplaints: 0, pendingApprovals: 0, messages: 0 });
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const nav = useMemo(() => getMobileNavigation(role), [role]);

  useEffect(() => {
    setSearchParams(window.location.search);
    setMoreOpen(false);
    const sync = () => setSearchParams(window.location.search);
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, [pathname]);

  useEffect(() => {
    const load = () => {
      fetch("/api/nav/badges")
        .then((response) => (response.ok ? response.json() : null))
        .then((data) => {
          if (!data) return;
          setBadges({
            unreadNotifications: data.unreadNotifications ?? 0,
            pendingComplaints: data.pendingComplaints ?? 0,
            pendingApprovals: data.pendingApprovals ?? 0,
            messages: data.messages ?? 0,
          });
        })
        .catch(() => undefined);
    };
    if (typeof window.requestIdleCallback === "function") {
      const idle = window.requestIdleCallback(load, { timeout: 4000 });
      return () => window.cancelIdleCallback(idle);
    }
    const timer = window.setTimeout(load, 1200);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const onResize = () => {
      const focused = document.activeElement;
      const typing = focused instanceof HTMLElement && focused.matches("input, textarea, select, [contenteditable='true']");
      setKeyboardOpen(Boolean(typing && viewport.height < window.innerHeight * 0.72));
    };
    viewport.addEventListener("resize", onResize);
    return () => viewport.removeEventListener("resize", onResize);
  }, []);

  const badgeFor = (key?: string) => {
    if (key === "complaints") return badges.pendingComplaints;
    if (key === "approvals") return badges.pendingApprovals;
    if (key === "messages") return badges.messages;
    if (key === "notifications") return badges.unreadNotifications;
    return 0;
  };

  const isActive = (href: string) => {
    const [path, query] = href.split("?");
    if (pathname !== path && !(path !== "/dashboard" && pathname.startsWith(`${path}/`) && !query)) return false;
    if (query) return searchParams.includes(query);
    return true;
  };

  const shortLabel = (label: string) => (label === "My Learning" ? "Learning" : label);

  const inMore = nav.moreCategories.some((category) => category.items.some((item) => isActive(item.href)));
  const filtered = nav.moreCategories
    .map((category) => ({
      ...category,
      items: category.items.filter((item) => item.label.toLowerCase().includes(search.trim().toLowerCase())),
    }))
    .filter((category) => category.items.length > 0);
  const moreBadge = badges.pendingApprovals + badges.unreadNotifications;

  if (keyboardOpen) return null;

  return (
    <>
      <nav aria-label="Main navigation" className="mobile-nav">
        {nav.primary.map(({ label, href, icon: Icon, badgeKey }) => {
          const active = isActive(href);
          const count = badgeFor(badgeKey);
          return (
            <Link key={label} href={href} aria-current={active ? "page" : undefined} className="mobile-nav-item" prefetch>
              <span className="relative grid place-items-center">
                <Icon size={21} strokeWidth={active ? 2.4 : 1.9} aria-hidden="true" />
                {count > 0 ? (
                  <span className="absolute -right-2.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[10px] font-semibold leading-none text-white">
                    {count > 9 ? "9+" : count}
                  </span>
                ) : null}
              </span>
              <span>{shortLabel(label)}</span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          aria-label="More pages"
          aria-expanded={moreOpen}
          data-active={inMore && !nav.primary.some((item) => isActive(item.href))}
          className="mobile-nav-item"
        >
          <span className="relative grid place-items-center">
            <MoreHorizontal size={21} aria-hidden="true" />
            {moreBadge > 0 ? (
              <span className="absolute -right-2.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-brand px-1 text-[10px] font-semibold leading-none text-white">
                {moreBadge > 9 ? "9+" : moreBadge}
              </span>
            ) : null}
          </span>
          <span>More</span>
        </button>
      </nav>

      <Sheet open={moreOpen} onClose={() => setMoreOpen(false)} title="All pages" description="Everything you can open, grouped">
        <div className="relative">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Find a page"
            aria-label="Find a page"
            className="input pl-9"
          />
        </div>
        <div className="space-y-4">
          {filtered.map((category) => (
            <div key={category.category}>
              <p className="field-label">{category.category}</p>
              <div className="grid grid-cols-2 gap-2">
                {category.items.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.href);
                  return (
                    <Link
                      key={`${item.label}:${item.href}`}
                      href={item.href}
                      onClick={() => setMoreOpen(false)}
                      aria-current={active ? "page" : undefined}
                      className={`flex min-h-11 min-w-0 items-center gap-2 rounded-xl border px-2.5 py-2 text-label font-semibold ${
                        active ? "border-brand-line bg-brand-soft text-brand-ink" : "border-line bg-surface text-ink hover:border-brand-line"
                      }`}
                    >
                      <Icon size={16} className="shrink-0" aria-hidden="true" />
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
          {filtered.length === 0 ? <p className="py-6 text-center text-label text-ink-2">No pages match “{search.trim()}”.</p> : null}
        </div>
      </Sheet>
    </>
  );
}
