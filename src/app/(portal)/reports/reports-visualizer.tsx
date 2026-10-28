"use client";

import { useState } from "react";
import {
  Download,
  FileBarChart2,
  Wallet,
  BookOpenCheck,
  Users,
  Layers,
  ShieldCheck,
} from "lucide-react";

export interface FinanceData {
  totalInvoiced: number;
  totalCollected: number;
  totalBalance: number;
  collectionRate: number;
  invoiceCount: number;
  terms: Array<{
    term: string;
    invoiced: number;
    collected: number;
    balance: number;
  }>;
}

export interface AssessmentData {
  total: number;
  avgScore: number;
  descriptors: {
    ee: { count: number; pct: number };
    me: { count: number; pct: number };
    ae: { count: number; pct: number };
    be: { count: number; pct: number };
  };
  subjects: Array<{
    subject: string;
    avg: number;
    count: number;
  }>;
}

export interface LearnerGradeData {
  grade: string;
  count: number;
  pct: number;
}

interface Props {
  finance: FinanceData;
  assessment: AssessmentData;
  learners: {
    total: number;
    byGrade: LearnerGradeData[];
  };
}

const kes = (n: number) =>
  new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 0,
  }).format(n);

export default function ReportsVisualizer({ finance, assessment, learners }: Props) {
  const [activeTab, setActiveTab] = useState<"all" | "finance" | "academics" | "learners">("all");

  const maxGradeCount = Math.max(...learners.byGrade.map((g) => g.count), 1);
  const maxTermInvoiced = Math.max(...finance.terms.map((t) => t.invoiced), 1);

  return (
    <div className="space-y-8">
      {/* View Switcher Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 pb-4 dark:border-slate-800">
        <div className="flex flex-wrap items-center gap-1.5 rounded-2xl bg-slate-100/80 p-1.5 dark:bg-slate-800/60">
          <button
            onClick={() => setActiveTab("all")}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
              activeTab === "all"
                ? "bg-white text-blue-700 shadow-sm dark:bg-slate-900 dark:text-blue-400"
                : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            }`}
          >
            <Layers size={14} />
            Executive Overview
          </button>
          <button
            onClick={() => setActiveTab("finance")}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
              activeTab === "finance"
                ? "bg-white text-blue-700 shadow-sm dark:bg-slate-900 dark:text-blue-400"
                : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            }`}
          >
            <Wallet size={14} />
            Finance &amp; Collections
          </button>
          <button
            onClick={() => setActiveTab("academics")}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
              activeTab === "academics"
                ? "bg-white text-blue-700 shadow-sm dark:bg-slate-900 dark:text-blue-400"
                : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            }`}
          >
            <BookOpenCheck size={14} />
            CBC Assessment Marks
          </button>
          <button
            onClick={() => setActiveTab("learners")}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
              activeTab === "learners"
                ? "bg-white text-blue-700 shadow-sm dark:bg-slate-900 dark:text-blue-400"
                : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            }`}
          >
            <Users size={14} />
            Learner Demographics
          </button>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-500">
          <ShieldCheck size={15} className="text-emerald-600" />
          <span>Live encrypted database exports</span>
        </div>
      </div>

      {/* SECTION 1: FINANCIAL HEALTH & FEE COLLECTIONS */}
      {(activeTab === "all" || activeTab === "finance") && (
        <section className="glass dark:glass-dark rounded-3xl border border-slate-200/80 p-6 shadow-sm transition-all dark:border-slate-800/80">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4 dark:border-slate-800">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                <Wallet size={13} />
                Financial Intelligence
              </div>
              <h2 className="mt-2 text-xl font-black text-slate-900 sm:text-2xl dark:text-white">
                Fee Collections &amp; Arrears Aging
              </h2>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Live reconciliation across {finance.invoiceCount} invoices and confirmed bank/M-Pesa deposits.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="rounded-xl border border-emerald-200/80 bg-emerald-50/80 px-3 py-1.5 text-xs font-extrabold text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                {finance.collectionRate}% Recovered
              </span>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-12">
            {/* Visual Graph Column */}
            <div className="space-y-6 lg:col-span-8">
              {/* Macro Metric Stats */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Total Billed</span>
                  <p className="mt-1 font-mono text-xl font-black text-slate-900 dark:text-white">
                    {kes(finance.totalInvoiced)}
                  </p>
                </div>
                <div className="rounded-2xl border border-emerald-200/70 bg-emerald-50/50 p-4 shadow-sm dark:border-emerald-900/40 dark:bg-emerald-950/20">
                  <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">Confirmed Collected</span>
                  <p className="mt-1 font-mono text-xl font-black text-emerald-700 dark:text-emerald-300">
                    {kes(finance.totalCollected)}
                  </p>
                </div>
                <div className="rounded-2xl border border-amber-200/70 bg-amber-50/50 p-4 shadow-sm dark:border-amber-900/40 dark:bg-amber-950/20">
                  <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-400">Outstanding Arrears</span>
                  <p className="mt-1 font-mono text-xl font-black text-amber-700 dark:text-amber-300">
                    {kes(finance.totalBalance)}
                  </p>
                </div>
              </div>

              {/* Graphical Term Comparison Chart */}
              <div className="rounded-2xl border border-slate-200/70 bg-white/60 p-5 dark:border-slate-800 dark:bg-slate-900/50">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Term-by-Term Billed vs Collected
                  </h3>
                  <div className="flex items-center gap-4 text-[11px] font-medium">
                    <span className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Collected
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-slate-300 dark:bg-slate-700" /> Billed Target
                    </span>
                  </div>
                </div>

                {finance.terms.length === 0 ? (
                  <p className="py-8 text-center text-xs text-slate-400">No term invoices recorded yet.</p>
                ) : (
                  <div className="space-y-4">
                    {finance.terms.map((t) => {
                      const rate = t.invoiced > 0 ? Math.round((t.collected / t.invoiced) * 100) : 0;
                      const collectedWidth = Math.min(100, Math.round((t.collected / maxTermInvoiced) * 100));
                      const invoicedWidth = Math.min(100, Math.round((t.invoiced / maxTermInvoiced) * 100));

                      return (
                        <div key={t.term} className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-slate-800 dark:text-slate-200">{t.term}</span>
                            <span className="font-mono text-[11px] text-slate-500">
                              {kes(t.collected)} / {kes(t.invoiced)}{" "}
                              <span className="font-bold text-emerald-600 dark:text-emerald-400">({rate}%)</span>
                            </span>
                          </div>

                          {/* Dual comparative bar */}
                          <div className="relative h-6 w-full overflow-hidden rounded-xl bg-slate-100 p-0.5 dark:bg-slate-800">
                            {/* Invoiced backdrop bar */}
                            <div
                              className="absolute inset-y-1 left-1 rounded-lg bg-slate-200 dark:bg-slate-700/80 transition-all duration-500"
                              style={{ width: `${invoicedWidth}%` }}
                            />
                            {/* Collected overlay bar */}
                            <div
                              className="relative h-full rounded-lg bg-gradient-to-r from-emerald-600 to-teal-500 transition-all duration-700 shadow-sm"
                              style={{ width: `${collectedWidth}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Beside: Action & Download Panel */}
            <div className="flex flex-col justify-between rounded-2xl border border-emerald-200/90 bg-gradient-to-b from-emerald-50/70 to-teal-50/40 p-5 shadow-sm dark:border-emerald-900/60 dark:from-emerald-950/40 dark:to-teal-950/20 lg:col-span-4">
              <div>
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-600 text-white shadow-md shadow-emerald-600/30">
                  <FileBarChart2 size={24} />
                </div>
                <h3 className="mt-4 text-base font-black text-slate-900 dark:text-white">
                  Fee Collections &amp; Balances Report
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                  Complete line-item ledger containing invoice timestamps, learner admission details, credit adjustments,
                  receipt codes, and net balances.
                </p>

                <div className="mt-4 space-y-2 rounded-xl bg-white/80 p-3 text-xs dark:bg-slate-900/70">
                  <div className="flex justify-between text-slate-600 dark:text-slate-300">
                    <span>Format</span>
                    <span className="font-bold text-slate-900 dark:text-white">CSV (Excel &amp; MIS compatible)</span>
                  </div>
                  <div className="flex justify-between text-slate-600 dark:text-slate-300">
                    <span>Invoices Captured</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">{finance.invoiceCount}</span>
                  </div>
                  <div className="flex justify-between text-slate-600 dark:text-slate-300">
                    <span>Security Audit</span>
                    <span className="font-semibold text-emerald-600">Logged to Event Store</span>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-emerald-200/70 dark:border-emerald-900/50">
                <a
                  href="/api/reports/finance"
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-xs font-bold text-white shadow-lg shadow-emerald-600/25 transition-all hover:bg-emerald-700 active:scale-95"
                >
                  <Download size={16} />
                  <span>Download Finance CSV</span>
                </a>
                <p className="mt-2 text-center text-[10px] text-slate-400">
                  Live snapshot generated at download request
                </p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* SECTION 2: CBC ACADEMIC ASSESSMENT ANALYTICS */}
      {(activeTab === "all" || activeTab === "academics") && (
        <section className="glass dark:glass-dark rounded-3xl border border-slate-200/80 p-6 shadow-sm transition-all dark:border-slate-800/80">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4 dark:border-slate-800">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-purple-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-purple-800 dark:bg-purple-950/60 dark:text-purple-300">
                <BookOpenCheck size={13} />
                Academic Excellence
              </div>
              <h2 className="mt-2 text-xl font-black text-slate-900 sm:text-2xl dark:text-white">
                CBC Assessment &amp; Competency Distribution
              </h2>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Performance descriptors and curriculum mastery across {assessment.total} released learner marks.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="rounded-xl border border-purple-200/80 bg-purple-50/80 px-3 py-1.5 text-xs font-extrabold text-purple-800 dark:border-purple-800 dark:bg-purple-950/40 dark:text-purple-300">
                School Average: {assessment.avgScore}%
              </span>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-12">
            {/* Visual Graph Column */}
            <div className="space-y-6 lg:col-span-8">
              {/* Descriptors 4-Level Distribution Card */}
              <div className="rounded-2xl border border-slate-200/70 bg-white/70 p-5 dark:border-slate-800 dark:bg-slate-900/60">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Curriculum Performance Descriptors (EE / ME / AE / BE)
                </h3>

                {/* Stacked Proportional Bar */}
                <div className="mt-4 h-4 w-full overflow-hidden rounded-full bg-slate-100 flex dark:bg-slate-800">
                  <div
                    title={`Exceeding: ${assessment.descriptors.ee.count} (${assessment.descriptors.ee.pct}%)`}
                    style={{ width: `${assessment.descriptors.ee.pct}%` }}
                    className="bg-emerald-500 transition-all duration-700"
                  />
                  <div
                    title={`Meeting: ${assessment.descriptors.me.count} (${assessment.descriptors.me.pct}%)`}
                    style={{ width: `${assessment.descriptors.me.pct}%` }}
                    className="bg-blue-600 transition-all duration-700"
                  />
                  <div
                    title={`Approaching: ${assessment.descriptors.ae.count} (${assessment.descriptors.ae.pct}%)`}
                    style={{ width: `${assessment.descriptors.ae.pct}%` }}
                    className="bg-amber-400 transition-all duration-700"
                  />
                  <div
                    title={`Below: ${assessment.descriptors.be.count} (${assessment.descriptors.be.pct}%)`}
                    style={{ width: `${assessment.descriptors.be.pct}%` }}
                    className="bg-rose-500 transition-all duration-700"
                  />
                </div>

                {/* 4 Legend Metric Boxes */}
                <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-3 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                    <div className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                      <span className="text-[10px] font-bold uppercase text-emerald-800 dark:text-emerald-300">EE (80-100%)</span>
                    </div>
                    <p className="mt-1 font-mono text-lg font-black text-emerald-900 dark:text-emerald-200">
                      {assessment.descriptors.ee.count}{" "}
                      <span className="text-xs font-normal text-emerald-600">({assessment.descriptors.ee.pct}%)</span>
                    </p>
                    <p className="text-[10px] text-emerald-700/80">Exceeding Expectations</p>
                  </div>

                  <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-3 dark:border-blue-900/40 dark:bg-blue-950/20">
                    <div className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-blue-600" />
                      <span className="text-[10px] font-bold uppercase text-blue-800 dark:text-blue-300">ME (60-79%)</span>
                    </div>
                    <p className="mt-1 font-mono text-lg font-black text-blue-900 dark:text-blue-200">
                      {assessment.descriptors.me.count}{" "}
                      <span className="text-xs font-normal text-blue-600">({assessment.descriptors.me.pct}%)</span>
                    </p>
                    <p className="text-[10px] text-blue-700/80">Meeting Expectations</p>
                  </div>

                  <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-3 dark:border-amber-900/40 dark:bg-amber-950/20">
                    <div className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                      <span className="text-[10px] font-bold uppercase text-amber-800 dark:text-amber-300">AE (40-59%)</span>
                    </div>
                    <p className="mt-1 font-mono text-lg font-black text-amber-900 dark:text-amber-200">
                      {assessment.descriptors.ae.count}{" "}
                      <span className="text-xs font-normal text-amber-600">({assessment.descriptors.ae.pct}%)</span>
                    </p>
                    <p className="text-[10px] text-amber-700/80">Approaching Expectations</p>
                  </div>

                  <div className="rounded-xl border border-rose-100 bg-rose-50/50 p-3 dark:border-rose-900/40 dark:bg-rose-950/20">
                    <div className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
                      <span className="text-[10px] font-bold uppercase text-rose-800 dark:text-rose-300">BE (&lt;40%)</span>
                    </div>
                    <p className="mt-1 font-mono text-lg font-black text-rose-900 dark:text-rose-200">
                      {assessment.descriptors.be.count}{" "}
                      <span className="text-xs font-normal text-rose-600">({assessment.descriptors.be.pct}%)</span>
                    </p>
                    <p className="text-[10px] text-rose-700/80">Below Expectations</p>
                  </div>
                </div>
              </div>

              {/* Subject Breakdown Bars */}
              {assessment.subjects.length > 0 && (
                <div className="rounded-2xl border border-slate-200/70 bg-white/60 p-5 dark:border-slate-800 dark:bg-slate-900/50">
                  <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Subject Performance Averages
                  </h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {assessment.subjects.slice(0, 6).map((sub) => (
                      <div key={sub.subject} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="font-semibold text-slate-700 dark:text-slate-300">{sub.subject}</span>
                          <span className="font-mono font-bold text-purple-700 dark:text-purple-400">{sub.avg}%</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                          <div
                            className="h-full rounded-full bg-purple-600 transition-all duration-500"
                            style={{ width: `${sub.avg}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Beside: Action & Download Panel */}
            <div className="flex flex-col justify-between rounded-2xl border border-purple-200/90 bg-gradient-to-b from-purple-50/70 to-indigo-50/40 p-5 shadow-sm dark:border-purple-900/60 dark:from-purple-950/40 dark:to-indigo-950/20 lg:col-span-4">
              <div>
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-purple-600 text-white shadow-md shadow-purple-600/30">
                  <BookOpenCheck size={24} />
                </div>
                <h3 className="mt-4 text-base font-black text-slate-900 dark:text-white">
                  Released Assessments Report
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                  Export of all released CBC assessment submissions, containing learning areas, core competencies,
                  performance level rubrics, and certified remarks.
                </p>

                <div className="mt-4 space-y-2 rounded-xl bg-white/80 p-3 text-xs dark:bg-slate-900/70">
                  <div className="flex justify-between text-slate-600 dark:text-slate-300">
                    <span>Format</span>
                    <span className="font-bold text-slate-900 dark:text-white">CSV (Spreadsheet &amp; KNEC ready)</span>
                  </div>
                  <div className="flex justify-between text-slate-600 dark:text-slate-300">
                    <span>Released Marks</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">{assessment.total}</span>
                  </div>
                  <div className="flex justify-between text-slate-600 dark:text-slate-300">
                    <span>Curriculum Baseline</span>
                    <span className="font-semibold text-purple-600">Kenyan CBC 2-6-3-3-3</span>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-purple-200/70 dark:border-purple-900/50">
                <a
                  href="/api/reports/assessments"
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-purple-600 px-5 py-3 text-xs font-bold text-white shadow-lg shadow-purple-600/25 transition-all hover:bg-purple-700 active:scale-95"
                >
                  <Download size={16} />
                  <span>Download Assessment CSV</span>
                </a>
                <p className="mt-2 text-center text-[10px] text-slate-400">
                  Live snapshot generated at download request
                </p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* SECTION 3: LEARNER REGISTER & ENROLLMENT ANALYTICS */}
      {(activeTab === "all" || activeTab === "learners") && (
        <section className="glass dark:glass-dark rounded-3xl border border-slate-200/80 p-6 shadow-sm transition-all dark:border-slate-800/80">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4 dark:border-slate-800">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-blue-800 dark:bg-blue-950/60 dark:text-blue-300">
                <Users size={13} />
                Learner Demographics
              </div>
              <h2 className="mt-2 text-xl font-black text-slate-900 sm:text-2xl dark:text-white">
                Grade Enrollment &amp; School Register
              </h2>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Class distribution across {learners.total} active learners on the school roll.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="rounded-xl border border-blue-200/80 bg-blue-50/80 px-3 py-1.5 text-xs font-extrabold text-blue-800 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300">
                {learners.total} Registered Learners
              </span>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-12">
            {/* Visual Graph Column */}
            <div className="space-y-4 lg:col-span-8">
              <div className="rounded-2xl border border-slate-200/70 bg-white/70 p-5 dark:border-slate-800 dark:bg-slate-900/60">
                <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Pupils Enrolled by Grade
                </h3>

                {learners.byGrade.length === 0 ? (
                  <p className="py-8 text-center text-xs text-slate-400">No active learners enrolled.</p>
                ) : (
                  <div className="space-y-3">
                    {learners.byGrade.map((item) => {
                      const barWidth = Math.max(8, Math.round((item.count / maxGradeCount) * 100));

                      return (
                        <div key={item.grade} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-slate-800 dark:text-slate-200">{item.grade}</span>
                            <span className="font-mono text-slate-500">
                              <span className="font-bold text-blue-700 dark:text-blue-300">{item.count}</span> learners ({item.pct}%)
                            </span>
                          </div>
                          <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-blue-700 to-indigo-500 transition-all duration-500"
                              style={{ width: `${barWidth}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Beside: Action & Download Panel */}
            <div className="flex flex-col justify-between rounded-2xl border border-blue-200/90 bg-gradient-to-b from-blue-50/70 to-sky-50/40 p-5 shadow-sm dark:border-blue-900/60 dark:from-blue-950/40 dark:to-sky-950/20 lg:col-span-4">
              <div>
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-700 text-white shadow-md shadow-blue-700/30">
                  <Users size={24} />
                </div>
                <h3 className="mt-4 text-base font-black text-slate-900 dark:text-white">
                  Learner Register (Master CSV)
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                  Full student nominal roll including admission numbers, verified grade assignments, admission dates,
                  and guardian links for Kisumu county records.
                </p>

                <div className="mt-4 space-y-2 rounded-xl bg-white/80 p-3 text-xs dark:bg-slate-900/70">
                  <div className="flex justify-between text-slate-600 dark:text-slate-300">
                    <span>Format</span>
                    <span className="font-bold text-slate-900 dark:text-white">CSV (County MOE Compliant)</span>
                  </div>
                  <div className="flex justify-between text-slate-600 dark:text-slate-300">
                    <span>Total Pupils</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">{learners.total}</span>
                  </div>
                  <div className="flex justify-between text-slate-600 dark:text-slate-300">
                    <span>Verification</span>
                    <span className="font-semibold text-blue-700 dark:text-blue-400">Head Teacher Authorized</span>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-blue-200/70 dark:border-blue-900/50">
                <a
                  href="/api/reports/learners"
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 py-3 text-xs font-bold text-white shadow-lg shadow-blue-700/25 transition-all hover:bg-blue-800 active:scale-95"
                >
                  <Download size={16} />
                  <span>Download Register CSV</span>
                </a>
                <p className="mt-2 text-center text-[10px] text-slate-400">
                  Audit-logged live export
                </p>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
