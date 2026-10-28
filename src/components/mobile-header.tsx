"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Search, X } from "lucide-react";
import NotificationBell from "@/components/notification-bell";
import { useTheme } from "@/components/design-system/theme-provider";
import { getMobileNavigation } from "@/lib/navigation";
import { IconButton } from "@/components/ui/actions";

type Props = { active: string; homeHref: string; user: { name: string; role: string; roleLabel: string; email?: string | null; avatarUrl?: string | null } };
type PersonResult = { id: string; title: string; subtitle: string; href: string };

function readPeople(payload: unknown, kind: "learners" | "staff"): PersonResult[] {
  if (!payload || typeof payload !== "object" || !(kind in payload)) return [];
  const rows = (payload as Record<string, unknown>)[kind];
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((row): PersonResult[] => {
    if (!row || typeof row !== "object") return [];
    const person = row as Record<string, unknown>;
    if (typeof person.id !== "string" || typeof person.name !== "string") return [];
    const subtitle = kind === "learners"
      ? [person.admissionNo, person.grade].filter((part): part is string => typeof part === "string").join(" · ")
      : typeof person.role === "string" ? person.role.replaceAll("_", " ") : "Staff";
    return [{ id: person.id, title: person.name, subtitle, href: kind === "learners" ? `/learners/${person.id}` : `/staff/${person.id}` }];
  });
}

export default function MobileHeader({ active, homeHref, user }: Props) {
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const [profileOpen, setProfileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [peopleResults, setPeopleResults] = useState<PersonResult[]>([]);
  const [hidden, setHidden] = useState(false);
  const { theme, style, setTheme, setStyle } = useTheme();
  const items = useMemo(() => {
    const navigation = getMobileNavigation(user.role);
    return [...navigation.primary, ...navigation.moreCategories.flatMap((group) => group.items)];
  }, [user.role]);
  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle ? items.filter((item) => item.label.toLowerCase().includes(needle)) : items.slice(0, 6);
  }, [items, query]);
  const isDetail = pathname.split("/").filter(Boolean).length > 1;
  const initials = user.name.trim().split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase();

  useEffect(() => {
    if (!searchOpen) return;
    try {
      const stored: unknown = JSON.parse(localStorage.getItem("mary-recent-searches") ?? "[]");
      setRecentSearches(Array.isArray(stored) ? stored.filter((item): item is string => typeof item === "string").slice(0, 5) : []);
    } catch { setRecentSearches([]); }
  }, [searchOpen]);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) { setPeopleResults([]); return; }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      const requests = await Promise.all([
        user.role !== "Welfare Chair" && user.role !== "Non-Teaching Staff"
          ? fetch(`/api/learners?q=${encodeURIComponent(term)}&take=5`, { signal: controller.signal }).catch(() => null)
          : Promise.resolve(null),
        user.role === "Director" || user.role === "Head Teacher"
          ? fetch(`/api/staff?q=${encodeURIComponent(term)}`, { signal: controller.signal }).catch(() => null)
          : Promise.resolve(null),
      ]);
      const payloads = await Promise.all(requests.map(async (response) => response?.ok ? response.json() as Promise<unknown> : null));
      setPeopleResults([...readPeople(payloads[0], "learners"), ...readPeople(payloads[1], "staff")]);
    }, 200);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [query, user.role]);

  useEffect(() => {
    let previousY = window.scrollY;
    const onScroll = () => {
      const currentY = window.scrollY;
      setHidden(currentY > 100 && currentY > previousY + 5);
      if (currentY < 40 || currentY < previousY - 5) setHidden(false);
      previousY = currentY;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setProfileOpen(false);
        setSearchOpen(false);
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, []);

  function back() {
    const parent = `/${pathname.split("/").filter(Boolean).slice(0, -1).join("/")}`;
    router.replace(parent === "/" || parent === pathname ? homeHref : parent);
  }

  return <>
    <header aria-label="Mobile app bar" className={`mobile-app-header sticky top-0 z-40 flex h-14 items-center gap-2 border-b border-slate-200 bg-white px-3 pt-[env(safe-area-inset-top)] transition-transform dark:border-slate-800 dark:bg-slate-950 lg:hidden ${hidden ? "-translate-y-full" : "translate-y-0"}`}>
      {isDetail ? <IconButton ariaLabel="Go back" onClick={back} className="grid place-items-center rounded-xl text-slate-700 dark:text-slate-200"><ArrowLeft size={21}/></IconButton> : <Link href={homeHref} aria-label="Mary Royal home" className="grid min-h-11 min-w-11 place-items-center rounded-xl"><Image src="/mary-royal-logo.png" alt="" width={30} height={30}/></Link>}
      <div className="min-w-0 flex-1 truncate text-lg font-semibold text-slate-950 dark:text-white">{active}</div>
      <IconButton ariaLabel="Search" onClick={() => setSearchOpen(true)} className="grid place-items-center rounded-xl text-slate-700 dark:text-slate-200"><Search size={20}/></IconButton>
      <div className="grid h-11 w-11 place-items-center"><NotificationBell/></div>
      <IconButton ariaLabel="Open profile menu" onClick={() => setProfileOpen(true)} className="grid place-items-center rounded-full">
        <span className="relative grid h-9 w-9 place-items-center overflow-hidden rounded-full bg-blue-100 text-sm font-semibold text-blue-900 ring-1 ring-blue-200 dark:bg-blue-950 dark:text-blue-100 dark:ring-blue-800">
          {user.avatarUrl ? <Image src={user.avatarUrl} alt="" fill sizes="36px" className="object-cover" unoptimized/> : initials}
        </span>
      </IconButton>
    </header>

    {profileOpen && <div role="presentation" className="fixed inset-0 z-[70] flex items-end bg-slate-950/50 lg:hidden" onClick={() => setProfileOpen(false)}>
      <section role="dialog" aria-modal="true" aria-label="Profile and preferences" className="w-full rounded-t-3xl bg-white px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 text-slate-900 shadow-2xl dark:bg-slate-900 dark:text-white" onClick={(event) => event.stopPropagation()}>
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-slate-300 dark:bg-slate-700"/>
        <div className="mb-4"><p className="text-base font-semibold">{user.name}</p><p className="text-sm text-slate-600 dark:text-slate-300">{user.roleLabel}{user.email ? ` · ${user.email}` : ""}</p></div>
        <p className="mb-2 text-sm font-semibold">Layout style</p><Segmented options={["bento", "glass"]} selected={style} onSelect={setStyle} labels={{ bento: "Bento", glass: "Glass"}}/>
        <p className="mb-2 mt-4 text-sm font-semibold">Colour mode</p><Segmented options={["light", "dark", "system"]} selected={theme} onSelect={setTheme} labels={{ light: "Light", dark: "Dark", system: "System"}}/>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Link href="/profile" onClick={() => setProfileOpen(false)} className="flex min-h-12 items-center justify-center rounded-xl border border-slate-200 text-sm font-semibold dark:border-slate-700">Profile & password</Link>
          <Link href="/privacy" onClick={() => setProfileOpen(false)} className="flex min-h-12 items-center justify-center rounded-xl border border-slate-200 text-sm font-semibold dark:border-slate-700">Help & privacy</Link>
        </div>
        <form action="/api/logout" method="post" className="mt-4 border-t border-slate-200 pt-3 dark:border-slate-700" onSubmit={(event) => { if (!window.confirm("Sign out of Mary Royal School?")) event.preventDefault(); }}>
          <button type="submit" className="min-h-12 w-full rounded-xl bg-rose-50 text-sm font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-200">Sign out</button>
        </form>
      </section>
    </div>}

    {searchOpen && <div className="fixed inset-0 z-[80] flex flex-col bg-white px-4 pb-[env(safe-area-inset-bottom)] pt-[max(1rem,env(safe-area-inset-top))] text-slate-900 dark:bg-slate-950 dark:text-white lg:hidden" role="dialog" aria-modal="true" aria-label="Search Mary Royal">
      <div className="flex items-center gap-2"><button type="button" aria-label="Close search" onClick={() => { setSearchOpen(false); setQuery(""); }} className="grid min-h-11 min-w-11 place-items-center rounded-xl"><X size={20}/></button><input autoFocus type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search pages" className="h-12 min-w-0 flex-1 rounded-xl border border-slate-300 bg-slate-50 px-4 text-base text-slate-900 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-600 dark:border-slate-700 dark:bg-slate-900 dark:text-white"/></div>
      {!query && recentSearches.length > 0 && <div className="flex flex-wrap gap-2 px-1 pt-4">{recentSearches.map((recent) => <button key={recent} type="button" onClick={() => setQuery(recent)} className="min-h-10 rounded-full bg-slate-100 px-3 text-sm font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">{recent}</button>)}</div>}
      {query && peopleResults.length > 0 && <><p className="px-1 pb-2 pt-5 text-sm font-semibold text-slate-600 dark:text-slate-300">People</p><div className="overflow-y-auto">{peopleResults.map((person) => <Link key={`${person.href}:${person.id}`} href={person.href} onClick={() => setSearchOpen(false)} className="flex min-h-12 items-center gap-3 border-b border-slate-100 dark:border-slate-800"><span className="min-w-0 flex-1 truncate text-base font-medium">{person.title}</span><span className="text-sm text-slate-600 dark:text-slate-300">{person.subtitle}</span></Link>)}</div></>}
      <p className="px-1 pb-2 pt-5 text-sm font-semibold text-slate-600 dark:text-slate-300">{query ? "Pages" : "Quick links"}</p>
      <div className="overflow-y-auto">{matches.map((item) => { const Icon = item.icon; return <Link key={`${item.label}:${item.href}`} href={item.href} onClick={() => { if (query.trim()) { const next = [query.trim(), ...recentSearches.filter((value) => value !== query.trim())].slice(0, 5); setRecentSearches(next); localStorage.setItem("mary-recent-searches", JSON.stringify(next)); } setSearchOpen(false); }} className="flex min-h-12 items-center gap-3 border-b border-slate-100 text-base font-medium dark:border-slate-800"><Icon size={20}/>{item.label}</Link>; })}{matches.length === 0 && peopleResults.length === 0 && <p className="py-6 text-sm text-slate-600">No matches found. Try another search.</p>}</div>
    </div>}
  </>;
}

function Segmented<T extends string>({ options, selected, onSelect, labels }: { options: T[]; selected: T; onSelect: (value: T) => void; labels: Record<T, string> }) {
  return <div className="grid grid-cols-[repeat(auto-fit,minmax(0,1fr))] gap-1 rounded-2xl bg-slate-100 p-1 dark:bg-slate-800">{options.map((option) => <button key={option} type="button" aria-pressed={selected === option} onClick={() => onSelect(option)} className={`min-h-12 rounded-xl px-2 text-sm font-semibold transition ${selected === option ? "bg-white text-blue-800 shadow-sm dark:bg-slate-700 dark:text-blue-100" : "text-slate-700 dark:text-slate-200"}`}>{labels[option]}</button>)}</div>;
}
