"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

const formBaselines = new Map<HTMLFormElement, string>();
const editedForms = new Set<HTMLFormElement>();
const blockedPaths = new Set(["/", "/login", "/change-password"]);
const replaceablePaths = new Set(["/admissions/new"]);
const humanize = (value: string) => value.replaceAll("-", " ").replace(/\b\w/g, letter => letter.toUpperCase());

function formSnapshot(form: HTMLFormElement) {
  return JSON.stringify([...form.elements].map((element) => {
    if (element instanceof HTMLInputElement) return [element.type, element.type === "file" ? [...(element.files ?? [])].map(file => file.name) : element.type === "checkbox" || element.type === "radio" ? element.checked : element.value];
    if (element instanceof HTMLTextAreaElement) return element.value;
    if (element instanceof HTMLSelectElement) return [...element.selectedOptions].map(option => option.value);
    return null;
  }));
}

function hasUnsavedChanges() {
  return [...editedForms].some(form => form.isConnected && formSnapshot(form) !== formBaselines.get(form));
}

function readStack(key: string): string[] {
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(key) ?? "[]");
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.startsWith("/")) : [];
  } catch { return []; }
}

export default function PageNavigation({ active, homeHref, userId }: { active: string; homeHref: string; userId: string }) {
  const pathname = usePathname() ?? "/dashboard";
  const router = useRouter();
  const storageKey = useMemo(() => `mary-navigation:${userId}`, [userId]);
  const [previousPath, setPreviousPath] = useState<string | null>(null);
  const isHome = pathname === homeHref || pathname === "/dashboard" && homeHref === "/dashboard";
  const segments = pathname.split("/").filter(Boolean);
  const hasDetail = segments.length > 1;

  useEffect(() => {
    if (blockedPaths.has(pathname)) {
      sessionStorage.removeItem(storageKey);
      return;
    }
    const stack = readStack(storageKey);
    let returnedToEarlierPage = false;
    if (replaceablePaths.has(pathname)) {
      // Keep transient create routes out of history so Back returns to the originating list.
    } else if (replaceablePaths.has(stack.at(-1) ?? "")) {
      stack[stack.length - 1] = pathname;
    } else if (stack.at(-2) === pathname) {
      stack.pop();
      returnedToEarlierPage = true;
    } else if (stack.at(-1) !== pathname) stack.push(pathname);
    const bounded = stack.slice(-40);
    sessionStorage.setItem(storageKey, JSON.stringify(bounded));
    const previous = bounded.length > 1 ? bounded[bounded.length - 2] : null;
    setPreviousPath(previous && !blockedPaths.has(previous) && previous !== pathname ? previous : null);
    formBaselines.clear();
    editedForms.clear();
    for (const form of document.forms) formBaselines.set(form, formSnapshot(form));
    if (returnedToEarlierPage) {
      try {
        const positions: unknown = JSON.parse(sessionStorage.getItem(`${storageKey}:scroll`) ?? "{}");
        const y = positions && typeof positions === "object" ? (positions as Record<string, unknown>)[pathname] : undefined;
        if (typeof y === "number" && Number.isFinite(y)) requestAnimationFrame(() => window.scrollTo({ top: y, behavior: "instant" }));
      } catch { /* Ignore damaged scroll state. */ }
    }
  }, [pathname, storageKey]);

  useEffect(() => {
    const rememberScroll = () => {
      const positions: Record<string, number> = {};
      try {
        Object.assign(positions, JSON.parse(sessionStorage.getItem(`${storageKey}:scroll`) ?? "{}"));
        positions[pathname] = window.scrollY;
        sessionStorage.setItem(`${storageKey}:scroll`, JSON.stringify(positions));
      } catch { sessionStorage.setItem(`${storageKey}:scroll`, JSON.stringify({ [pathname]: window.scrollY })); }
    };
    const onInput = (event: Event) => {
      const target = event.target;
      if (target instanceof HTMLElement) {
        const form = target.closest("form");
        if (form instanceof HTMLFormElement) {
          if (!formBaselines.has(form)) formBaselines.set(form, formSnapshot(form));
          editedForms.add(form);
        }
      }
    };
    const onSubmit = (event: Event) => { if (event.target instanceof HTMLFormElement) { formBaselines.set(event.target, formSnapshot(event.target)); editedForms.delete(event.target); } };
    const onLinkClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement) || anchor.target === "_blank") return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname === pathname) return;
      rememberScroll();
      if (hasUnsavedChanges() && !window.confirm("You have unsaved changes. Leave this page and discard them?")) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      rememberScroll();
      if (!hasUnsavedChanges()) return;
      event.preventDefault();
      event.returnValue = "";
    };
    const onFocusIn = (event: FocusEvent) => {
      const target = event.target;
      if (target instanceof HTMLElement) {
        const form = target.closest("form");
        if (form instanceof HTMLFormElement && !formBaselines.has(form)) formBaselines.set(form, formSnapshot(form));
      }
    };
    const onPopState = () => {
      rememberScroll();
      if (!hasUnsavedChanges()) return;
      if (window.confirm("You have unsaved changes. Leave this page and discard them?")) { formBaselines.clear(); editedForms.clear(); }
      else window.history.forward();
    };
    document.addEventListener("input", onInput, true);
    document.addEventListener("change", onInput, true);
    document.addEventListener("submit", onSubmit, true);
    document.addEventListener("focusin", onFocusIn, true);
    document.addEventListener("click", onLinkClick, true);
    window.addEventListener("beforeunload", onBeforeUnload);
    window.addEventListener("popstate", onPopState);
    return () => {
      document.removeEventListener("input", onInput, true);
      document.removeEventListener("change", onInput, true);
      document.removeEventListener("submit", onSubmit, true);
      document.removeEventListener("focusin", onFocusIn, true);
      document.removeEventListener("click", onLinkClick, true);
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.removeEventListener("popstate", onPopState);
    };
  }, [pathname, storageKey]);

  const back = useCallback(() => {
    if (hasUnsavedChanges() && !window.confirm("You have unsaved changes. Leave this page and discard them?")) return;
    formBaselines.clear();
    editedForms.clear();
    if (pathname.startsWith("/admissions/")) window.location.replace("/learners");
    else {
      const segmentsNow = pathname.split("/").filter(Boolean);
      if (segmentsNow.length === 1) { window.location.replace(homeHref); return; }
      if (previousPath && previousPath !== pathname && !blockedPaths.has(previousPath) && !replaceablePaths.has(previousPath)) { router.replace(previousPath); return; }
      const fallback = pathname.startsWith("/receipts/") ? homeHref === "/portal" ? "/portal" : "/finance" : segmentsNow.length > 1 ? `/${segmentsNow.slice(0, -1).join("/")}` : homeHref;
      router.replace(fallback === pathname || blockedPaths.has(fallback) ? homeHref : fallback);
    }
  }, [homeHref, pathname, previousPath, router]);

  const homeLabel = homeHref === "/portal" ? "My children" : homeHref === "/learning" ? "My learning" : "Dashboard";
  const breadcrumb = useMemo(() => {
    if (isHome) return [{ label: active, href: homeHref }];
    if (pathname.startsWith("/receipts/")) return [{ label: homeLabel, href: homeHref }, { label: active, href: pathname }];
    if (hasDetail) {
      const parent = `/${segments.slice(0, -1).join("/")}`;
      return [{ label: homeLabel, href: homeHref }, { label: humanize(segments.at(-2) ?? active), href: parent }, { label: humanize(segments.at(-1) ?? active), href: pathname }];
    }
    return [{ label: homeLabel, href: homeHref }, { label: active, href: pathname }];
  }, [active, hasDetail, homeHref, homeLabel, isHome, pathname, segments]);

  return <div className="hidden border-b border-slate-200/70 bg-white/75 px-4 py-2.5 backdrop-blur lg:block lg:px-10 print:hidden">
    <div className="flex min-h-8 items-center gap-3">
      {!isHome && <button type="button" aria-label="Go back" onClick={back} className="hidden h-8 shrink-0 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-slate-600 transition hover:bg-blue-50 hover:text-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 lg:inline-flex"><ArrowLeft size={15}/> Back</button>}
      <nav aria-label="Breadcrumb" className="hidden min-w-0 items-center gap-1.5 overflow-x-auto text-xs text-slate-500 lg:flex">
        {breadcrumb.map((item, index) => <span key={`${item.href}-${index}`} className="flex shrink-0 items-center gap-1.5">
          {index > 0 && <ChevronRight size={13} aria-hidden="true"/>}
          {index === breadcrumb.length - 1 ? <span aria-current="page" className="max-w-48 truncate font-semibold text-slate-800">{item.label}</span> : <Link href={item.href} className="rounded px-1 py-1 hover:text-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">{item.label}</Link>}
        </span>)}
      </nav>
    </div>
  </div>;
}
