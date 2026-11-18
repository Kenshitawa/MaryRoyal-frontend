"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, HelpCircle, LogOut, Monitor, Moon, Search, Settings2, ShieldCheck, Sparkles, Sun, X } from "lucide-react";
import NotificationBell from "@/components/notification-bell";
import { useTheme, type UIStyle } from "@/components/design-system/theme-provider";
import { getMobileNavigation, getSectionForPath } from "@/lib/navigation";
import { IconButton } from "@/components/ui/actions";
import { Sheet } from "@/components/ui/sheet";
import ConfirmLogoutForm from "@/components/confirm-logout-form";

type HeaderUser = { id: string; name: string; email?: string | null; role: string; roleLabel: string; avatarUrl?: string | null };
type PersonResult = { id: string; title: string; subtitle: string; href: string };

function readPeople(payload: unknown, kind: "learners" | "staff"): PersonResult[] {
  if (!payload || typeof payload !== "object" || !(kind in payload)) return [];
  const rows = (payload as Record<string, unknown>)[kind];
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((row): PersonResult[] => {
    if (!row || typeof row !== "object") return [];
    const person = row as Record<string, unknown>;
    if (typeof person.id !== "string" || typeof person.name !== "string") return [];
    const subtitle =
      kind === "learners"
        ? [person.admissionNo, person.grade].filter((part): part is string => typeof part === "string").join(" · ")
        : typeof person.role === "string"
          ? person.role.replaceAll("_", " ")
          : "Staff";
    return [{ id: person.id, title: person.name, subtitle, href: kind === "learners" ? `/learners/${person.id}` : `/staff/${person.id}` }];
  });
}

export function PortalHeader({ user }: { user: HeaderUser }) {
  const pathname = usePathname() ?? "/";
  const section = getSectionForPath(pathname, user.role);
  const [profileOpen, setProfileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const nav = useMemo(() => getMobileNavigation(user.role), [user.role]);
  const isPrimaryTab = useMemo(
    () => nav.primary.some((item) => item.href.split("?")[0] === pathname.split("?")[0]),
    [nav, pathname],
  );
  const parts = pathname.split("/").filter(Boolean);
  const isDetail = parts.length > 1 && !isPrimaryTab;

  function goBack() {
    window.dispatchEvent(new Event("mary-go-back"));
  }

  return (
    <>
      <header aria-label="Mobile app bar" className="app-mobile-bar">
        <div className="flex min-w-0 flex-1 items-center gap-1">
          {isDetail ? <IconButton ariaLabel="Go back" onClick={goBack}><ArrowLeft size={20} /></IconButton> : null}
          <p className="min-w-0 truncate text-body font-semibold text-ink">{section}</p>
        </div>
        <Link href={user.role === "PARENT" ? "/portal" : user.role === "LEARNER" ? "/learning" : "/dashboard"} aria-label="Mary Royal home" className="app-mobile-brand icon-btn">
          <span className="grid size-8 place-items-center rounded-md bg-brand-mark-surface p-0.5">
            <Image src="/mary-royal-logo.png" alt="" width={32} height={32} className="h-full w-full object-contain" />
          </span>
        </Link>
        <div className="flex shrink-0 items-center gap-0.5">
          <IconButton ariaLabel="Search" onClick={() => setSearchOpen(true)}><Search size={19} /></IconButton>
          <NotificationBell />
          <button type="button" aria-label="Open profile menu" onClick={() => setProfileOpen(true)} className="grid h-11 w-11 shrink-0 place-items-center rounded-full">
            <span className="grid h-8 w-8 place-items-center overflow-hidden rounded-full bg-brand-soft text-label font-semibold text-brand-ink ring-1 ring-brand-line">
              {user.avatarUrl ? <Image src={user.avatarUrl} alt="" width={32} height={32} className="h-8 w-8 object-cover" unoptimized /> : initials(user.name)}
            </span>
          </button>
        </div>
      </header>

      <Sheet open={profileOpen} onClose={() => setProfileOpen(false)} title={user.name} description={`${user.roleLabel}${user.email ? ` · ${user.email}` : ""}`}>
        <ProfileSheetBody user={user} onNavigate={() => setProfileOpen(false)} />
      </Sheet>

      {searchOpen ? <SearchOverlay role={user.role} onClose={() => setSearchOpen(false)} /> : null}
    </>
  );
}

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function ProfileSheetBody({
  user,
  onNavigate,
}: {
  user: HeaderUser;
  onNavigate: () => void;
}) {
  const { theme, style, setStyle, toggleTheme } = useTheme();
  const themeLabel = theme === "dark" ? "Dark" : theme === "system" ? "System" : "Light";
  const ThemeIcon = theme === "dark" ? Moon : theme === "system" ? Monitor : Sun;
  return (
    <div className="space-y-4">
      <div className="royal-panel flex items-center gap-3 rounded-2xl border border-border-button-default p-3.5 text-white shadow-sm">
        <span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-full bg-white/15 text-body font-bold ring-2 ring-white/25">
          {user.avatarUrl ? (
            <Image src={user.avatarUrl} alt="" width={48} height={48} className="size-12 object-cover" unoptimized />
          ) : (
            initials(user.name)
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-body font-bold">{user.name}</p>
          <p className="truncate text-label text-text-white/85">{user.roleLabel}</p>
          {user.email ? <p className="truncate text-caption text-text-white/70">{user.email}</p> : null}
        </div>
      </div>
      <div>
        <p className="field-label">Appearance</p>
        <Segmented<UIStyle>
          options={["bento", "glass"]}
          selected={style}
          onSelect={setStyle}
          labels={{ bento: "Bento", glass: "Glass" }}
        />
      </div>
      <div>
        <p className="field-label">Colour mode</p>
        <div className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-border-button-default bg-background-secondary-default px-3">
          <span className="min-w-0">
            <span className="block text-label font-semibold text-text-primary">Colour mode</span>
            <span className="block text-caption text-text-tertiary">{themeLabel}</span>
          </span>
          <IconButton
            ariaLabel={`Colour mode: ${themeLabel}. Switch to the next mode.`}
            title={`Switch mode (currently ${themeLabel})`}
            onClick={toggleTheme}
            className="size-9 shrink-0"
          >
            <ThemeIcon size={17} aria-hidden="true" />
          </IconButton>
        </div>
      </div>
      <div className="grid gap-2">
        <Link href="/assistant" onClick={onNavigate} className="list-row">
          <Sparkles size={18} className="shrink-0 text-warning" aria-hidden="true" />
          <span className="min-w-0 flex-1 text-body font-semibold">Ask me anything</span>
        </Link>
        <Link href="/help" onClick={onNavigate} className="list-row">
          <HelpCircle size={18} className="shrink-0 text-text-secondary" aria-hidden="true" />
          <span className="min-w-0 flex-1 text-body font-semibold">Help & guides</span>
        </Link>
        <Link href="/profile" onClick={onNavigate} className="list-row">
          <Settings2 size={18} className="shrink-0 text-ink-2" aria-hidden="true" />
          <span className="min-w-0 flex-1 text-body font-semibold">Profile & password</span>
        </Link>
        <Link href="/privacy" onClick={onNavigate} className="list-row">
          <ShieldCheck size={18} className="shrink-0 text-ink-2" aria-hidden="true" />
          <span className="min-w-0 flex-1 text-body font-semibold">Help & privacy</span>
        </Link>
      </div>
      <ConfirmLogoutForm
        className="w-full"
        buttonClassName="btn btn-secondary w-full text-danger"
        ariaLabel="Sign out of Mary Royal School"
        title="Sign out"
      >
        <span className="inline-flex items-center gap-2">
          <LogOut size={16} aria-hidden="true" /> Sign out
        </span>
      </ConfirmLogoutForm>
    </div>
  );
}

function Segmented<T extends string>({
  options,
  selected,
  onSelect,
  labels,
}: {
  options: T[];
  selected: T;
  onSelect: (value: T) => void;
  labels: Record<T, string>;
}) {
  return (
    <div className="grid gap-1 rounded-xl bg-surface-2 p-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={selected === option}
          onClick={() => onSelect(option)}
          className={`flex min-h-11 items-center justify-center gap-1.5 rounded-lg text-label font-semibold transition ${
            selected === option ? "bg-surface text-brand-ink shadow-sm" : "text-ink-2"
          }`}
        >
          {option === "light" ? <Sun size={14} /> : option === "dark" ? <Moon size={14} /> : null}
          {labels[option]}
        </button>
      ))}
    </div>
  );
}

function SearchOverlay({ role, onClose }: { role: string; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [people, setPeople] = useState<PersonResult[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const nav = useMemo(() => getMobileNavigation(role), [role]);

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setPeople([]);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      const responses = await Promise.all([
        role !== "WELFARE_CHAIR" && role !== "NON_TEACHING_STAFF"
          ? fetch(`/api/learners?q=${encodeURIComponent(term)}&take=5`, { signal: controller.signal }).catch(() => null)
          : Promise.resolve(null),
        role === "DIRECTOR" || role === "HEAD_TEACHER"
          ? fetch(`/api/staff?q=${encodeURIComponent(term)}`, { signal: controller.signal }).catch(() => null)
          : Promise.resolve(null),
      ]);
      const payloads = await Promise.all(responses.map(async (response) => (response?.ok ? (response.json() as Promise<unknown>) : null)));
      setPeople([...readPeople(payloads[0], "learners"), ...readPeople(payloads[1], "staff")]);
    }, 200);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, role]);

  const needle = query.trim().toLowerCase();
  const matches = [...nav.primary, ...nav.moreCategories.flatMap((category) => category.items)].filter((item) =>
    needle ? item.label.toLowerCase().includes(needle) : true,
  ).slice(0, needle ? 12 : 6);

  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-canvas px-4 pb-[env(safe-area-inset-bottom)] pt-[max(12px,env(safe-area-inset-top))] text-ink">
      <div className="flex items-center gap-2">
        <IconButton ariaLabel="Close search" onClick={onClose}>
          <X size={20} />
        </IconButton>
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search pages and people"
          aria-label="Search pages and people"
          className="input flex-1"
        />
      </div>
      <div className="mt-4 flex-1 overflow-y-auto pb-6">
        {people.length > 0 ? (
          <>
            <p className="field-label">People</p>
            <div className="mb-4 space-y-1">
              {people.map((person) => (
                <Link key={`${person.href}:${person.id}`} href={person.href} onClick={onClose} className="list-row">
                  <span className="min-w-0 flex-1 truncate text-body font-semibold">{person.title}</span>
                  <span className="shrink-0 text-caption text-ink-3">{person.subtitle}</span>
                </Link>
              ))}
            </div>
          </>
        ) : null}
        <p className="field-label">{query ? "Pages" : "Quick links"}</p>
        <div className="space-y-1">
          {matches.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={`${item.label}:${item.href}`} href={item.href} onClick={onClose} className="list-row">
                <Icon size={18} className="shrink-0 text-ink-2" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate text-body font-semibold">{item.label}</span>
                <Check size={14} className="text-transparent" aria-hidden="true" />
              </Link>
            );
          })}
          {matches.length === 0 && people.length === 0 ? (
            <p className="py-6 text-center text-label text-ink-2">No matches. Try another word.</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
