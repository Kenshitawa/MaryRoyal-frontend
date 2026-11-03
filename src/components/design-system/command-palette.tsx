"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, X, Users, BookOpen, ArrowRight, User } from "lucide-react";

interface SearchItem {
  id: string;
  title: string;
  subtitle: string;
  category: "Page" | "Learner" | "Staff" | "Action";
  href: string;
}

const defaultPages: SearchItem[] = [
  { id: "p-dash", title: "Overview Dashboard", subtitle: "Main role workspace", category: "Page", href: "/dashboard" },
  { id: "p-learn", title: "Learners Register", subtitle: "Active school learners and classes", category: "Page", href: "/learners" },
  { id: "p-adm", title: "Admissions Pipeline", subtitle: "Admit learner & review applications", category: "Page", href: "/admissions" },
  { id: "p-att", title: "Attendance Register", subtitle: "Daily attendance and follow-up", category: "Page", href: "/attendance" },
  { id: "p-ass", title: "Assessments & Marks", subtitle: "CBC grading and exams", category: "Page", href: "/assessments" },
  { id: "p-fin", title: "Fees & Finance", subtitle: "Invoices, payments, receipts", category: "Page", href: "/finance" },
  { id: "p-comp", title: "Parent Concerns", subtitle: "Private support channel", category: "Page", href: "/complaints" },
  { id: "p-acc", title: "Accounts & Roles", subtitle: "Manage staff accounts", category: "Page", href: "/accounts" },
];

export function CommandPalette({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchItem[]>(defaultPages);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(false);

  // Global keyboard shortcut (Ctrl+K or Cmd+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (isOpen) onClose();
        else {
          setQuery("");
          setResults(defaultPages);
        }
      } else if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Live search when query changes
  const search = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults(defaultPages);
      return;
    }
    setLoading(true);
    try {
      const filteredPages = defaultPages.filter(p =>
        p.title.toLowerCase().includes(q.toLowerCase()) ||
        p.subtitle.toLowerCase().includes(q.toLowerCase())
      );

      // Fetch matching learners
      const res = await fetch(`/api/learners?query=${encodeURIComponent(q)}&take=6`);
      let learnerItems: SearchItem[] = [];
      if (res.ok) {
        const data = await res.json();
        learnerItems = (data.learners || []).map((l: { id: string; name: string; admissionNo: string; grade: string }) => ({
          id: `l-${l.id}`,
          title: l.name,
          subtitle: `${l.admissionNo} · ${l.grade}`,
          category: "Learner" as const,
          href: `/learners/${l.id}`
        }));
      }

      setResults([...filteredPages, ...learnerItems]);
      setSelectedIndex(0);
    } catch {
      // fallback
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void search(query);
    }, 150);
    return () => clearTimeout(timer);
  }, [query, search]);

  const selectItem = (item: SearchItem) => {
    onClose();
    router.push(item.href);
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Command palette search"
      className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/50 p-4 pt-16 sm:pt-24 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900"
        onClick={e => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3.5 dark:border-slate-800">
          <Search size={18} className="text-slate-400" />
          <input
            autoFocus
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search learners, staff, pages, or invoices... (Ctrl+K)"
            className="flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-white"
            onKeyDown={e => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setSelectedIndex(i => Math.min(results.length - 1, i + 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setSelectedIndex(i => Math.max(0, i - 1));
              } else if (e.key === "Enter" && results[selectedIndex]) {
                e.preventDefault();
                selectItem(results[selectedIndex]);
              }
            }}
          />
          <button
            type="button"
            aria-label="Close search"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
          >
            <X size={16} />
          </button>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-2">
          {loading && (
            <p className="p-3 text-center text-xs text-slate-400">Searching...</p>
          )}

          {!loading && results.length === 0 && (
            <div className="p-8 text-center text-sm text-slate-400">
              No results found for &ldquo;{query}&rdquo;
            </div>
          )}

          {results.map((item, idx) => {
            const isSelected = idx === selectedIndex;
            return (
              <div
                key={item.id}
                onClick={() => selectItem(item)}
                onMouseEnter={() => setSelectedIndex(idx)}
                className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl px-3.5 py-2.5 transition ${
                  isSelected
                    ? "bg-blue-50 text-blue-900 dark:bg-blue-950/60 dark:text-blue-100"
                    : "text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800/60"
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${
                      item.category === "Learner"
                        ? "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300"
                        : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                    }`}
                  >
                    {item.category === "Learner" ? (
                      <User size={15} />
                    ) : item.category === "Page" ? (
                      <BookOpen size={15} />
                    ) : (
                      <Users size={15} />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold">{item.title}</p>
                    <p className="truncate text-[11px] text-slate-400">{item.subtitle}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500 dark:bg-slate-800">
                    {item.category}
                  </span>
                  {isSelected && <ArrowRight size={13} className="text-blue-600 dark:text-blue-400" />}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer shortcuts hint */}
        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/70 px-4 py-2 text-[11px] text-slate-400 dark:border-slate-800 dark:bg-slate-900/50">
          <span>Navigate with ↑ ↓, press Enter to open</span>
          <span>ESC to close</span>
        </div>
      </div>
    </div>
  );
}
