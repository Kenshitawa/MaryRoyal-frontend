"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Layers,
  Plus,
  Receipt,
  Search,
  Sparkles,
  Tag,
  Trash2,
} from "lucide-react";

type FeeLine = {
  id?: string;
  category: string;
  description: string;
  amount: number;
  optional: boolean;
};
type Structure = {
  id: string;
  grade: string;
  term: string;
  version: number;
  effectiveFrom: string;
  active: boolean;
  createdBy: { name: string };
  lines: FeeLine[];
};

const categories = [
  "TUITION",
  "TRANSPORT",
  "LUNCH",
  "BOARDING",
  "UNIFORM",
  "ACTIVITY",
  "EXAM",
  "OTHER",
];

const formatKes = (amount: number) =>
  new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 0,
  }).format(amount);

export default function FeeStructuresClient({ canManage }: { canManage: boolean }) {
  const [structures, setStructures] = useState<Structure[]>([]);
  const [grade, setGrade] = useState("Grade 4");
  const [term, setTerm] = useState(`${new Date().getFullYear()} Term 1`);
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().slice(0, 10));
  const [lines, setLines] = useState<FeeLine[]>([
    { category: "TUITION", description: "Tuition and instruction", amount: 15000, optional: false },
    { category: "LUNCH", description: "Hot lunch program", amount: 4500, optional: true },
  ]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState("");

  const refresh = useCallback(async () => {
    const response = await fetch("/api/finance/structures");
    if (response.ok) {
      setStructures(((await response.json()) as { structures: Structure[] }).structures);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  function updateLine(index: number, patch: Partial<FeeLine>) {
    setLines((current) =>
      current.map((line, i) => (i === index ? { ...line, ...patch } : line))
    );
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/finance/structures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grade, term, effectiveFrom, lines }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Fee structure could not be saved.");
      setMessage(`${grade} · ${term} fee structure saved as version ${result.structure.version}.`);
      setShowAdd(false);
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Fee structure could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  const filteredStructures = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return structures;
    return structures.filter(
      (s) =>
        s.grade.toLowerCase().includes(q) ||
        s.term.toLowerCase().includes(q) ||
        s.createdBy.name.toLowerCase().includes(q)
    );
  }, [structures, search]);

  const activeCount = structures.filter((s) => s.active).length;
  const uniqueGrades = new Set(structures.map((s) => s.grade)).size;

  return (
    <main className="mx-auto max-w-7xl p-4 pb-28 sm:p-6 md:p-8">
      {/* Back Link */}
      <Link
        href="/finance"
        className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-700 transition hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
      >
        <ArrowLeft size={14} />
        Back to Finance Overview
      </Link>

      {/* Header Banner */}
      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50/80 px-2.5 py-0.5 text-xs font-semibold text-blue-800 dark:border-blue-800/60 dark:bg-blue-950/40 dark:text-blue-300">
              <Layers size={12} />
              Tariff Settings
            </span>
          </div>
          <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-900 sm:text-3xl dark:text-white">
            Approved Fee Structures
          </h1>
          <p className="mt-1 text-xs text-slate-500 sm:text-sm dark:text-slate-400">
            Centrally defined tuition and auxiliary line-items per grade and term. All changes are
            versioned.
          </p>
        </div>

        {canManage && (
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-700 to-indigo-700 px-5 text-xs font-bold text-white shadow-md shadow-blue-700/20 transition hover:brightness-110 active:scale-95"
          >
            <Plus size={15} />
            {showAdd ? "Close Configuration" : "Configure Fee Structure"}
          </button>
        )}
      </div>

      {/* KPI Bento Grid */}
      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="glass dark:glass-dark rounded-3xl border border-slate-200/80 p-5 shadow-sm dark:border-slate-800/80">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Total Structures
            </span>
            <div className="rounded-xl bg-blue-50 p-2 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400">
              <Layers size={16} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 dark:text-white">
              {structures.length}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Across all versions</p>
        </div>

        <div className="glass dark:glass-dark rounded-3xl border border-slate-200/80 p-5 shadow-sm dark:border-slate-800/80">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Active Schedules
            </span>
            <div className="rounded-xl bg-emerald-50 p-2 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400">
              <CheckCircle2 size={16} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-700 dark:text-emerald-400">
              {activeCount}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Currently in effect</p>
        </div>

        <div className="glass dark:glass-dark rounded-3xl border border-slate-200/80 p-5 shadow-sm dark:border-slate-800/80">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Grades Covered
            </span>
            <div className="rounded-xl bg-indigo-50 p-2 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-400">
              <Tag size={16} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-indigo-700 dark:text-indigo-400">
              {uniqueGrades}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Distinct grade bands</p>
        </div>

        <div className="glass dark:glass-dark rounded-3xl border border-slate-200/80 p-5 shadow-sm dark:border-slate-800/80">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Authority
            </span>
            <div className="rounded-xl bg-purple-50 p-2 text-purple-700 dark:bg-purple-950/60 dark:text-purple-400">
              <Sparkles size={16} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-base font-black text-purple-700 dark:text-purple-400">
              Head Teacher / Director
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Statutory pricing rule</p>
        </div>
      </div>

      {message && (
        <div
          role="status"
          className="mt-6 flex items-center gap-2 rounded-2xl border border-blue-200 bg-blue-50/90 p-4 text-xs font-semibold text-blue-900 shadow-sm dark:border-blue-900/60 dark:bg-blue-950/50 dark:text-blue-300"
        >
          {message}
        </div>
      )}

      {/* Create / New Version Bento Form */}
      {canManage && showAdd && (
        <form
          onSubmit={save}
          className="glass dark:glass-dark mt-6 rounded-3xl border border-blue-200/80 p-6 shadow-md transition-all sm:p-7 dark:border-blue-900/60"
        >
          <div className="mb-5 flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-600 text-white shadow-sm">
              <Plus size={18} />
            </span>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Create Fee Schedule or Next Version
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Define the tuition, boarding, meals, or activity charges. Existing invoices preserve
                their billed amounts.
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Grade / Class <span className="text-blue-600">*</span>
              </label>
              <input
                required
                minLength={2}
                maxLength={20}
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                placeholder="e.g. Grade 4"
                className="mt-1.5 min-h-11 w-full rounded-2xl border border-slate-200 bg-white/70 px-4 text-xs font-medium text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Term Period <span className="text-blue-600">*</span>
              </label>
              <input
                required
                pattern="\d{4} Term [123]"
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder="e.g. 2026 Term 1"
                className="mt-1.5 min-h-11 w-full rounded-2xl border border-slate-200 bg-white/70 px-4 text-xs font-medium text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Effective Date <span className="text-blue-600">*</span>
              </label>
              <input
                required
                type="date"
                value={effectiveFrom}
                onChange={(e) => setEffectiveFrom(e.target.value)}
                className="mt-1.5 min-h-11 w-full rounded-2xl border border-slate-200 bg-white/70 px-4 text-xs font-medium text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              />
            </div>
          </div>

          {/* Fee Items Builder */}
          <div className="mt-6 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Fee Items & auxiliary charges
              </h3>
              <button
                type="button"
                onClick={() =>
                  setLines((curr) => [
                    ...curr,
                    { category: "OTHER", description: "", amount: 0, optional: false },
                  ])
                }
                className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-800 transition hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950/60 dark:text-blue-300"
              >
                <Plus size={13} />
                Add Line Item
              </button>
            </div>

            <div className="space-y-2.5">
              {lines.map((line, index) => (
                <div
                  key={index}
                  className="grid gap-3 rounded-2xl border border-slate-200/70 bg-slate-50/50 p-3.5 sm:grid-cols-[1fr_1.5fr_1fr_auto_auto] sm:items-end dark:border-slate-800 dark:bg-slate-900/40"
                >
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Category
                    </label>
                    <select
                      value={line.category}
                      onChange={(e) => updateLine(index, { category: e.target.value })}
                      className="mt-1 min-h-10 w-full rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                    >
                      {categories.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Description
                    </label>
                    <input
                      required
                      minLength={2}
                      maxLength={120}
                      value={line.description}
                      onChange={(e) => updateLine(index, { description: e.target.value })}
                      placeholder="e.g. Activity and swimming fee"
                      className="mt-1 min-h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Amount (KES)
                    </label>
                    <input
                      required
                      type="number"
                      min={line.optional ? 0 : 1}
                      step="1"
                      value={line.amount || ""}
                      onChange={(e) => updateLine(index, { amount: Number(e.target.value) })}
                      placeholder="0"
                      className="mt-1 min-h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                    />
                  </div>

                  <div className="flex h-10 items-center gap-1.5 pb-1">
                    <input
                      type="checkbox"
                      id={`opt-${index}`}
                      checked={line.optional}
                      onChange={(e) => updateLine(index, { optional: e.target.checked })}
                      className="h-4 w-4 rounded text-blue-600 focus:ring-blue-500"
                    />
                    <label
                      htmlFor={`opt-${index}`}
                      className="cursor-pointer text-xs font-semibold text-slate-600 dark:text-slate-400"
                    >
                      Optional
                    </label>
                  </div>

                  <div className="flex h-10 items-center pb-1">
                    <button
                      type="button"
                      aria-label={`Remove fee item ${line.label || index + 1}`}
                      disabled={lines.length === 1}
                      onClick={() => setLines((curr) => curr.filter((_, i) => i !== index))}
                      className="rounded-xl p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-700 disabled:opacity-30 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Form Footer */}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 pt-5 dark:border-slate-800">
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Mandatory Compulsory Total:{" "}
                <span className="text-base font-black text-slate-900 dark:text-white">
                  {formatKes(
                    lines.reduce((sum, line) => sum + (!line.optional ? line.amount : 0), 0)
                  )}
                </span>
              </p>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowAdd(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                disabled={busy}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-700 px-6 text-xs font-bold text-white shadow-md shadow-blue-700/20 transition hover:bg-blue-800 disabled:opacity-50"
              >
                <Sparkles size={14} />
                {busy ? "Saving Structure…" : "Save Approved Structure"}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Structures Grid Section */}
      <section className="glass dark:glass-dark mt-6 rounded-3xl border border-slate-200/80 p-6 shadow-sm dark:border-slate-800/80">
        <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
          <div>
            <h2 className="text-lg font-black tracking-tight text-slate-900 dark:text-white">
              Approved Tariff Schedules
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Each version is sealed. Modifying a tariff increments its version number.
            </p>
          </div>

          <div className="relative w-full max-w-xs">
            <Search
              size={15}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search grade or term…"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50/70 py-2 pl-9 pr-4 text-xs font-medium text-slate-900 outline-none focus:border-blue-600 focus:bg-white dark:border-slate-700 dark:bg-slate-900/60 dark:text-white"
            />
          </div>
        </div>

        <div className="mt-6">
          {filteredStructures.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 p-12 text-center dark:border-slate-800">
              <Receipt className="mx-auto text-blue-500" size={32} />
              <p className="mt-3 text-sm font-bold text-slate-900 dark:text-white">
                No fee structures found
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                School leaders can configure structures per grade above.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {filteredStructures.map((structure) => {
                const requiredTotal = structure.lines
                  .filter((l) => !l.optional)
                  .reduce((sum, l) => sum + l.amount, 0);

                return (
                  <article
                    key={structure.id}
                    className="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white/70 p-5 shadow-sm transition-all hover:border-blue-200 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/50"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-base font-black text-slate-900 dark:text-white">
                              {structure.grade}
                            </h3>
                            <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-bold text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                              {structure.term}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            Version {structure.version} · Effective{" "}
                            {new Date(structure.effectiveFrom).toLocaleDateString("en-KE")} · By{" "}
                            {structure.createdBy.name}
                          </p>
                        </div>

                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                            structure.active
                              ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                              : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                          }`}
                        >
                          {structure.active ? <CheckCircle2 size={11} /> : <Clock size={11} />}
                          {structure.active ? "Current Active" : "Archived Version"}
                        </span>
                      </div>

                      {/* Line items list */}
                      <div className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
                        {structure.lines.map((line, idx) => (
                          <div
                            key={line.id || idx}
                            className="flex items-center justify-between py-2 text-xs"
                          >
                            <span className="text-slate-700 dark:text-slate-300">
                              {line.description}
                              {line.optional && (
                                <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                                  Optional
                                </span>
                              )}
                            </span>
                            <span className="font-mono font-bold text-slate-900 dark:text-white">
                              {formatKes(line.amount)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
                      <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
                        Mandatory Total:
                      </span>
                      <span className="text-sm font-black text-blue-700 dark:text-blue-400">
                        {formatKes(requiredTotal)}
                      </span>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
