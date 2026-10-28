"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Wallet, Plus, Search, CheckCircle2, Download, X
} from "lucide-react";
import { ThemedCard } from "@/components/design-system/card";
import { StatusPill } from "@/components/design-system/status-pill";
import { LearnerLink } from "@/components/learner-link";

type Learner = { id: string; name: string; admissionNo: string; grade: string };
type Line = { id: string; category: string; description: string; amount: number; optional?: boolean };
type Payment = {
  id: string; receiptNo: string; amount: number; method: string;
  mpesaCode: string | null; reference: string | null; status: string;
  voidReason: string | null; createdAt: string;
};
type Invoice = {
  id: string;
  learner: { id: string; name: string; admissionNo: string; grade: string };
  term: string;
  lines: Line[];
  payments: Payment[];
  total: number;
  paid: number;
  balance: number;
  creditApplied: number;
  createdAt: string;
};
type FeeStructure = {
  id: string;
  grade: string;
  term: string;
  lines: Line[];
};
type FeeWaiver = {
  id: string;
  amount: number;
  reason: string;
  status: string;
  createdAt: string;
  invoice: { term: string; learner: { name: string; admissionNo: string; grade: string } };
  requestedBy: { name: string };
  approvedBy?: { name: string };
};

const kesShort = (n: number) =>
  n >= 1_000_000 ? `Ksh ${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `Ksh ${Math.round(n / 1_000)}K` : `Ksh ${n}`;

const kes = (n: number) =>
  new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(n);

export default function FinanceClient({
  canInvoice,
  canPay,
  canApprove,
  canVoid,
  canViewWaivers
}: {
  canInvoice: boolean;
  canPay: boolean;
  canApprove: boolean;
  canVoid: boolean;
  canViewWaivers: boolean;
}) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [learners, setLearners] = useState<Learner[]>([]);
  const [structures, setStructures] = useState<FeeStructure[]>([]);
  const [waivers, setWaivers] = useState<FeeWaiver[]>([]);
  const [activeTab, setActiveTab] = useState<"invoices" | "arrears" | "waivers">("invoices");

  // Stepper state for Create Invoice
  const [showInvoiceStepper, setShowInvoiceStepper] = useState(false);
  const [stepperStep, setStepperStep] = useState(1);
  const [selectedLearner, setSelectedLearner] = useState<Learner | null>(null);
  const [invoiceTerm, setInvoiceTerm] = useState("2026 Term 1");
  const [structureLines, setStructureLines] = useState<(Line & { selected: boolean })[]>([]);
  const [customDescription, setCustomDescription] = useState("");
  const [customAmount, setCustomAmount] = useState("");

  // Payment Drawer state
  const [showPaymentDrawer, setShowPaymentDrawer] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("MPESA");
  const [mpesaCode, setMpesaCode] = useState("");
  const [payRef, setPayRef] = useState("");
  const [paymentSuccess, setPaymentSuccess] = useState<{ receiptNo: string; id: string } | null>(null);

  // Waiver dialog
  const [showWaiverModal, setShowWaiverModal] = useState(false);
  const [waiverInvoiceId, setWaiverInvoiceId] = useState("");
  const [waiverAmount, setWaiverAmount] = useState("");
  const [waiverReason, setWaiverReason] = useState("");

  const [searchQuery, setSearchQuery] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [invRes, learnRes, structRes, waiverRes] = await Promise.all([
        fetch("/api/finance/invoices"),
        fetch("/api/learners?take=100"),
        fetch("/api/finance/structures"),
        canViewWaivers ? fetch("/api/finance/waivers") : Promise.resolve(null)
      ]);

      if (invRes.ok) setInvoices((await invRes.json()).invoices || []);
      if (learnRes.ok) setLearners((await learnRes.json()).learners || []);
      if (structRes.ok) setStructures((await structRes.json()).structures || []);
      if (waiverRes?.ok) setWaivers((await waiverRes.json()).waivers || []);
    } catch {
      // fallback
    }
  }, [canViewWaivers]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // When learner & term selected in Stepper, auto-load fee structure items
  useEffect(() => {
    if (!selectedLearner) return;
    const match = structures.find(s => s.grade === selectedLearner.grade && s.term === invoiceTerm);
    if (match && match.lines.length > 0) {
      setStructureLines(
        match.lines.map(l => ({
          ...l,
          selected: !l.optional // Compulsory auto-selected, optional toggled off by default
        }))
      );
    } else {
      // Default standard fee lines if no specific structure is found
      setStructureLines([
        { id: "def-1", category: "TUITION", description: `${invoiceTerm} Tuition`, amount: 16000, selected: true },
        { id: "def-2", category: "LUNCH", description: `${invoiceTerm} Lunch Programme`, amount: 4000, selected: true, optional: true },
        { id: "def-3", category: "TRANSPORT", description: `${invoiceTerm} School Bus`, amount: 5000, selected: false, optional: true },
        { id: "def-4", category: "ACTIVITY", description: `${invoiceTerm} Activity & Sports`, amount: 1500, selected: true }
      ]);
    }
  }, [selectedLearner, invoiceTerm, structures]);

  // Stepper calculations
  const stepperSelectedTotal = structureLines
    .filter(l => l.selected)
    .reduce((sum, l) => sum + l.amount, 0);

  // Submit invoice from Stepper
  const handleCreateInvoice = async () => {
    if (!selectedLearner) return;
    setBusy(true);
    setError("");
    try {
      const items = structureLines
        .filter(l => l.selected)
        .map(l => ({
          category: l.category,
          description: l.description,
          amount: l.amount
        }));

      if (customDescription && Number(customAmount) > 0) {
        items.push({
          category: "OTHER",
          description: customDescription,
          amount: Number(customAmount)
        });
      }

      const res = await fetch("/api/finance/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          learnerId: selectedLearner.id,
          term: invoiceTerm,
          items
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create invoice");

      setMessage(`Invoice generated successfully for ${selectedLearner.name}.`);
      setShowInvoiceStepper(false);
      setStepperStep(1);
      setSelectedLearner(null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error generating invoice");
    } finally {
      setBusy(false);
    }
  };

  // Submit payment from drawer
  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/finance/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceId: selectedInvoice.id,
          amount: Number(payAmount),
          method: payMethod,
          mpesaCode: payMethod === "MPESA" ? mpesaCode.trim().toUpperCase() : undefined,
          reference: payRef.trim() || undefined
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Payment recording failed");

      setPaymentSuccess({
        receiptNo: data.payment.receiptNo,
        id: data.payment.id
      });
      setPayAmount("");
      setMpesaCode("");
      setPayRef("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error recording payment");
    } finally {
      setBusy(false);
    }
  };

  // Submit waiver request
  const handleRequestWaiver = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/finance/waivers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceId: waiverInvoiceId,
          amount: Number(waiverAmount),
          reason: waiverReason
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit waiver");
      setMessage("Fee waiver request submitted for Director approval.");
      setShowWaiverModal(false);
      setWaiverAmount("");
      setWaiverReason("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error submitting waiver");
    } finally {
      setBusy(false);
    }
  };

  const handleApproveWaiver = async (waiverId: string, decision: "APPROVED" | "REJECTED") => {
    setBusy(true);
    try {
      const res = await fetch("/api/finance/waivers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ waiverId, decision })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMessage(`Waiver request marked ${decision}.`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to process waiver");
    } finally {
      setBusy(false);
    }
  };

  const voidPayment = async (p: Payment) => {
    const reason = window.prompt("Reason for voiding receipt (at least 10 characters):");
    if (!reason) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/finance/payments/${p.id}/void`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMessage(`Receipt ${p.receiptNo} voided and audit recorded.`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not void receipt");
    } finally {
      setBusy(false);
    }
  };

  const confirmPayment = async (p: Payment) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/finance/payments/${p.id}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMessage(`Payment ${p.receiptNo} confirmed. Official receipt now available.`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not confirm payment");
    } finally {
      setBusy(false);
    }
  };

  // Metrics summary
  const totalBilled = invoices.reduce((sum, i) => sum + i.total, 0);
  const totalCollected = invoices.reduce((sum, i) => sum + i.paid, 0);
  const totalOutstanding = invoices.reduce((sum, i) => sum + i.balance, 0);
  const collectionRate = totalBilled > 0 ? Math.round((totalCollected / totalBilled) * 100) : 0;

  // Aging buckets (0-30, 31-60, 61-90, 90+)
  const now = new Date().getTime();
  const aging = { b0_30: 0, b31_60: 0, b61_90: 0, b90plus: 0 };
  for (const inv of invoices) {
    if (inv.balance <= 0) continue;
    const daysOld = Math.floor((now - new Date(inv.createdAt).getTime()) / (1000 * 60 * 60 * 24));
    if (daysOld <= 30) aging.b0_30 += inv.balance;
    else if (daysOld <= 60) aging.b31_60 += inv.balance;
    else if (daysOld <= 90) aging.b61_90 += inv.balance;
    else aging.b90plus += inv.balance;
  }

  // Filter invoices based on search
  const filteredInvoices = invoices.filter(inv => {
    const q = searchQuery.toLowerCase();
    return (
      inv.learner.name.toLowerCase().includes(q) ||
      inv.learner.admissionNo.toLowerCase().includes(q) ||
      inv.learner.grade.toLowerCase().includes(q) ||
      inv.term.toLowerCase().includes(q)
    );
  });

  const invoiceActions = (inv: Invoice) => {
    const latestPayment = inv.payments[0];
    return (
      <div className="flex flex-wrap items-center gap-2">
        {canPay && inv.balance > 0 && (
          <button
            type="button"
            onClick={() => {
              setSelectedInvoice(inv);
              setPayAmount(String(inv.balance));
              setShowPaymentDrawer(true);
              setPaymentSuccess(null);
            }}
            className="btn btn-primary btn-sm"
          >
            Pay
          </button>
        )}
        {canApprove && latestPayment?.status === "PENDING" && (
          <button type="button" onClick={() => void confirmPayment(latestPayment)} className="btn btn-secondary btn-sm">
            Confirm payment
          </button>
        )}
        {canVoid && latestPayment && latestPayment.status !== "VOIDED" && (
          <button type="button" onClick={() => void voidPayment(latestPayment)} className="btn btn-danger btn-sm">
            Void
          </button>
        )}
        {inv.payments.length > 0 && (
          <a
            href={`/api/finance/payments/${inv.payments[0].id}/pdf`}
            target="_blank"
            rel="noreferrer"
            className="btn btn-secondary btn-sm"
            title="Download official PDF receipt with verification QR code"
          >
            <Download size={14} aria-hidden="true" />
            Receipt PDF
          </a>
        )}
        {canInvoice && (
          <button
            type="button"
            onClick={() => {
              setWaiverInvoiceId(inv.id);
              setShowWaiverModal(true);
            }}
            className="btn btn-ghost btn-sm"
            title="Request fee discount or waiver"
          >
            Discount
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {canInvoice && (
          <button
            type="button"
            onClick={() => {
              setShowInvoiceStepper(true);
              setStepperStep(1);
            }}
            className="btn btn-primary"
          >
            <Plus size={16} aria-hidden="true" />
            <span>Create invoice</span>
          </button>
        )}

        {canPay && (
          <button
            type="button"
            onClick={() => {
              setSelectedInvoice(invoices[0] || null);
              setShowPaymentDrawer(true);
              setPaymentSuccess(null);
            }}
            className="btn btn-secondary"
          >
            <Wallet size={16} aria-hidden="true" />
            <span>Record payment</span>
          </button>
        )}
      </div>

      {message && (
        <div role="status" className="rounded-xl bg-success-soft p-4 text-sm font-semibold text-success">
          {message}
        </div>
      )}
      {error && (
        <div role="alert" className="rounded-xl bg-danger-soft p-4 text-sm font-semibold text-danger">
          {error}
        </div>
      )}

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="card p-3.5">
          <p className="text-label font-semibold text-ink-2">Total invoiced</p>
          <p className="mt-2 text-kpi font-semibold tabular-nums text-ink">{kesShort(totalBilled)}</p>
          <p className="mt-1 text-caption text-ink-3">{invoices.length} learner invoices</p>
        </div>
        <div className="card p-3.5">
          <p className="text-label font-semibold text-ink-2">Collected</p>
          <p className="mt-2 text-kpi font-semibold tabular-nums text-success">{kesShort(totalCollected)}</p>
          <p className="mt-1 text-caption text-ink-3">{collectionRate}% collection target</p>
        </div>
        <div className="card p-3.5">
          <p className="text-label font-semibold text-ink-2">Outstanding arrears</p>
          <p className="mt-2 text-kpi font-semibold tabular-nums text-danger">{kesShort(totalOutstanding)}</p>
          <p className="mt-1 text-caption text-ink-3">Pending recovery</p>
        </div>
        <div className="card p-3.5">
          <p className="text-label font-semibold text-ink-2">Collection rate</p>
          <p className="mt-2 text-kpi font-semibold tabular-nums text-ink">{collectionRate}%</p>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface-2">
            <div className="h-full rounded-full bg-brand" style={{ width: `${collectionRate}%` }} />
          </div>
        </div>
      </div>

      {/* Tabs navigation */}
      <div className="grid grid-cols-3 gap-1 rounded-xl bg-surface-2 p-1" role="tablist" aria-label="Finance views">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "invoices"}
          onClick={() => setActiveTab("invoices")}
          className={`btn btn-sm ${activeTab === "invoices" ? "btn-secondary shadow-sm" : "btn-ghost"}`}
        >
          Invoices ({invoices.length})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "arrears"}
          onClick={() => setActiveTab("arrears")}
          className={`btn btn-sm ${activeTab === "arrears" ? "btn-secondary shadow-sm" : "btn-ghost"}`}
        >
          Arrears
        </button>
        {canViewWaivers && (
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "waivers"}
          onClick={() => setActiveTab("waivers")}
          className={`btn btn-sm ${activeTab === "waivers" ? "btn-secondary shadow-sm" : "btn-ghost"}`}
        >
          Waivers ({waivers.length})
        </button>
        )}
      </div>

      {/* TAB 1: Invoices & Receipts List */}
      {activeTab === "invoices" && (
        <ThemedCard className="overflow-hidden p-0">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4 dark:border-slate-800">
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 dark:border-slate-800 dark:bg-slate-900">
              <Search size={16} className="text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search learner or admission no."
                className="w-56 sm:w-72 bg-transparent text-xs outline-none placeholder:text-slate-400"
              />
            </div>
            <button
              onClick={() => void refresh()}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300"
            >
              Refresh Table
            </button>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800 lg:hidden">
            {filteredInvoices.length === 0 ? (
              <p className="p-6 text-center text-body text-ink-2">No matching fee invoices found.</p>
            ) : (
              filteredInvoices.map(inv => {
                const status = inv.balance <= 0 ? "PAID" : inv.paid > 0 ? "PARTIAL" : "UNPAID";
                return (
                  <article key={inv.id} className="min-w-0 p-4">
                    <div className="flex min-w-0 items-start justify-between gap-3">
                      <LearnerLink
                        id={inv.learner.id}
                        name={inv.learner.name}
                        admissionNo={inv.learner.admissionNo}
                        subtext={inv.learner.grade}
                      />
                      <StatusPill status={status} />
                    </div>
                    <p className="mt-1 text-label text-ink-2">{inv.term}</p>
                    {inv.lines.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {inv.lines.map(l => (
                          <span key={l.id} className="rounded bg-slate-100 px-1.5 py-0.5 text-caption font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                            {l.description}
                          </span>
                        ))}
                      </div>
                    )}
                    <dl className="mt-3 space-y-1 text-body">
                      <div className="flex justify-between gap-3">
                        <dt className="text-ink-2">Invoiced</dt>
                        <dd className="font-semibold text-ink tabular-nums">{kes(inv.total)}</dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-ink-2">Paid</dt>
                        <dd className="font-semibold text-success tabular-nums">{kes(inv.paid)}</dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-ink-2">Balance</dt>
                        <dd className="font-semibold text-ink tabular-nums">{kes(inv.balance)}</dd>
                      </div>
                    </dl>
                    <div className="mt-3">{invoiceActions(inv)}</div>
                  </article>
                );
              })
            )}
          </div>

          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50/70 text-caption uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800/40">
                <tr>
                  <th className="px-4 py-3.5">Learner</th>
                  <th className="px-4 py-3.5">Term</th>
                  <th className="px-4 py-3.5">Fee Items</th>
                  <th className="px-4 py-3.5">Invoiced</th>
                  <th className="px-4 py-3.5">Paid</th>
                  <th className="px-4 py-3.5">Balance</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-400">
                      No matching fee invoices found.
                    </td>
                  </tr>
                ) : (
                  filteredInvoices.map(inv => {
                    const status = inv.balance <= 0 ? "PAID" : inv.paid > 0 ? "PARTIAL" : "UNPAID";
                    return (
                      <tr key={inv.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                        <td className="px-4 py-3.5">
                          <LearnerLink
                            id={inv.learner.id}
                            name={inv.learner.name}
                            admissionNo={inv.learner.admissionNo}
                            subtext={inv.learner.grade}
                          />
                        </td>
                        <td className="px-4 py-3.5 font-semibold text-slate-700 dark:text-slate-300">{inv.term}</td>
                        <td className="px-4 py-3.5">
                          <div className="flex flex-wrap gap-1">
                            {inv.lines.map(l => (
                              <span key={l.id} className="rounded bg-slate-100 px-1.5 py-0.5 text-caption font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                {l.description}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3.5 font-bold text-slate-900 dark:text-white">{kes(inv.total)}</td>
                        <td className="px-4 py-3.5 font-bold text-emerald-700 dark:text-emerald-300">{kes(inv.paid)}</td>
                        <td className="px-4 py-3.5 font-extrabold text-slate-900 dark:text-white">{kes(inv.balance)}</td>
                        <td className="px-4 py-3.5">
                          <StatusPill status={status} />
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex justify-end">{invoiceActions(inv)}</div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </ThemedCard>
      )}

      {/* TAB 2: Arrears & Aging Buckets */}
      {activeTab === "arrears" && (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <ThemedCard className="border-l-4 border-l-blue-500 p-5">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Current (0–30 Days)</p>
              <p className="mt-2 text-2xl font-extrabold text-blue-700 dark:text-blue-300">{kes(aging.b0_30)}</p>
              <p className="mt-1 text-xs text-slate-500">Recently invoiced terms</p>
            </ThemedCard>

            <ThemedCard className="border-l-4 border-l-amber-500 p-5">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Overdue (31–60 Days)</p>
              <p className="mt-2 text-2xl font-extrabold text-amber-700 dark:text-amber-300">{kes(aging.b31_60)}</p>
              <p className="mt-1 text-xs text-slate-500">1st reminder stage</p>
            </ThemedCard>

            <ThemedCard className="border-l-4 border-l-orange-500 p-5">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Arrears (61–90 Days)</p>
              <p className="mt-2 text-2xl font-extrabold text-orange-700 dark:text-orange-300">{kes(aging.b61_90)}</p>
              <p className="mt-1 text-xs text-slate-500">2nd follow-up stage</p>
            </ThemedCard>

            <ThemedCard className="border-l-4 border-l-rose-600 p-5">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Chronic (90+ Days)</p>
              <p className="mt-2 text-2xl font-extrabold text-rose-700 dark:text-rose-300">{kes(aging.b90plus)}</p>
              <p className="mt-1 text-xs text-slate-500">Head Teacher review required</p>
            </ThemedCard>
          </div>

          <ThemedCard className="p-6">
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Top Outstanding Learner Arrears</h3>
            <p className="mt-1 text-xs text-slate-500">Learners with unpaid balances past due.</p>

            <div className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
              {invoices
                .filter(i => i.balance > 0)
                .sort((a, b) => b.balance - a.balance)
                .slice(0, 8)
                .map(inv => (
                  <div key={inv.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div>
                      <LearnerLink
                        id={inv.learner.id}
                        name={inv.learner.name}
                        admissionNo={inv.learner.admissionNo}
                        subtext={`${inv.learner.grade} · ${inv.term}`}
                      />
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-extrabold text-rose-700 dark:text-rose-400">
                        {kes(inv.balance)} due
                      </span>
                      <Link
                        href={`/learners/${inv.learner.id}`}
                        className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                      >
                        Profile
                      </Link>
                    </div>
                  </div>
                ))}
            </div>
          </ThemedCard>
        </div>
      )}

      {/* TAB 3: Waivers & Discounts */}
      {activeTab === "waivers" && (
        <ThemedCard className="p-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Fee Discount &amp; Waiver Requests</h3>
              <p className="mt-1 text-xs text-slate-500">Accountant submits waiver requests; Director authorizes.</p>
            </div>
          </div>

          <div className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
            {waivers.length === 0 ? (
              <p className="p-8 text-center text-xs text-slate-400">No waiver or discount requests recorded.</p>
            ) : (
              waivers.map(w => (
                <div key={w.id} className="flex flex-wrap items-center justify-between gap-3 py-3.5">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-slate-900 dark:text-white">{w.invoice.learner.name}</p>
                      <StatusPill status={w.status} />
                    </div>
                    <p className="text-xs text-slate-500">
                      {w.invoice.learner.admissionNo} · Amount: <strong>{kes(w.amount)}</strong> · Requested by {w.requestedBy.name}
                    </p>
                    <p className="mt-1 text-xs italic text-slate-600 dark:text-slate-400">&ldquo;{w.reason}&rdquo;</p>
                  </div>

                  {canApprove && w.status === "PENDING" && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApproveWaiver(w.id, "APPROVED")}
                        className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700"
                      >
                        Approve Discount
                      </button>
                      <button
                        onClick={() => handleApproveWaiver(w.id, "REJECTED")}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-50"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </ThemedCard>
      )}

      {/* STEPPER MODAL: Create Invoice */}
      {showInvoiceStepper && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-blue-600 text-xs font-bold text-white">
                  {stepperStep}
                </span>
                <h3 className="font-extrabold text-slate-900 dark:text-white">
                  {stepperStep === 1 && "Step 1: Choose Learner & Term"}
                  {stepperStep === 2 && "Step 2: Select Fee Structure Items"}
                  {stepperStep === 3 && "Step 3: Preview & Confirm Invoice"}
                </h3>
              </div>
              <button type="button" aria-label="Close invoice creator" onClick={() => setShowInvoiceStepper(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <div className="p-6">
              {stepperStep === 1 && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Search Learner</label>
                    <select
                      value={selectedLearner?.id || ""}
                      onChange={e => {
                        const found = learners.find(l => l.id === e.target.value);
                        setSelectedLearner(found || null);
                      }}
                      className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-800 dark:bg-slate-900"
                    >
                      <option value="">Select a learner from register</option>
                      {learners.map(l => (
                        <option key={l.id} value={l.id}>
                          {l.name} — {l.admissionNo} ({l.grade})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Academic Term</label>
                    <select
                      value={invoiceTerm}
                      onChange={e => setInvoiceTerm(e.target.value)}
                      className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-800 dark:bg-slate-900"
                    >
                      {["2026 Term 1", "2026 Term 2", "2026 Term 3"].map(t => (
                        <option key={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {stepperStep === 2 && (
                <div className="space-y-4">
                  <p className="text-xs text-slate-500">
                    Auto-loaded fee structure for <strong>{selectedLearner?.grade}</strong> ({invoiceTerm}). Toggle optional items as needed:
                  </p>

                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {structureLines.map((line, idx) => (
                      <label
                        key={line.id || idx}
                        className="flex items-center justify-between rounded-xl border border-slate-100 p-3 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/40 cursor-pointer"
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={line.selected}
                            disabled={!line.optional}
                            onChange={e => {
                              const copy = [...structureLines];
                              copy[idx].selected = e.target.checked;
                              setStructureLines(copy);
                            }}
                            className="h-4 w-4 rounded text-blue-600"
                          />
                          <div>
                            <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{line.description}</p>
                            <p className="text-[11px] text-slate-400">
                              {line.category} {line.optional ? "(Optional)" : "(Compulsory)"}
                            </p>
                          </div>
                        </div>
                        <span className="text-sm font-extrabold text-slate-900 dark:text-white">
                          {kes(line.amount)}
                        </span>
                      </label>
                    ))}
                  </div>

                  <div className="border-t border-slate-100 pt-3 dark:border-slate-800">
                    <p className="text-xs font-bold text-slate-500 mb-2">+ Add Special Line Item (Optional)</p>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        placeholder="Description (e.g. Uniform Set)"
                        value={customDescription}
                        onChange={e => setCustomDescription(e.target.value)}
                        className="rounded-xl border border-slate-200 px-3 py-2 text-xs dark:border-slate-800"
                      />
                      <input
                        type="number"
                        placeholder="Amount (KES)"
                        value={customAmount}
                        onChange={e => setCustomAmount(e.target.value)}
                        className="rounded-xl border border-slate-200 px-3 py-2 text-xs dark:border-slate-800"
                      />
                    </div>
                  </div>
                </div>
              )}

              {stepperStep === 3 && (
                <div className="space-y-4">
                  <div className="rounded-xl bg-blue-50 p-4 dark:bg-blue-950/40">
                    <p className="text-xs text-blue-600 font-bold uppercase tracking-wider">Invoice Summary</p>
                    <p className="mt-1 text-lg font-extrabold text-blue-950 dark:text-blue-100">{selectedLearner?.name}</p>
                    <p className="text-xs text-blue-800 dark:text-blue-300">
                      {selectedLearner?.admissionNo} · {selectedLearner?.grade} · {invoiceTerm}
                    </p>
                  </div>

                  <div className="space-y-1.5 text-xs">
                    {structureLines.filter(l => l.selected).map(l => (
                      <div key={l.id} className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                        <span>{l.description}</span>
                        <strong>{kes(l.amount)}</strong>
                      </div>
                    ))}
                    {customDescription && Number(customAmount) > 0 && (
                      <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                        <span>{customDescription}</span>
                        <strong>{kes(Number(customAmount))}</strong>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-between text-base font-extrabold pt-2 text-slate-900 dark:text-white border-t-2 border-slate-200 dark:border-slate-700">
                    <span>Total Invoiced</span>
                    <span className="text-blue-600">{kes(stepperSelectedTotal + (Number(customAmount) || 0))}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/70 px-6 py-4 dark:border-slate-800 dark:bg-slate-900/50">
              {stepperStep > 1 ? (
                <button
                  type="button"
                  onClick={() => setStepperStep(s => s - 1)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100"
                >
                  Back
                </button>
              ) : <div />}

              {stepperStep < 3 ? (
                <button
                  type="button"
                  disabled={!selectedLearner}
                  onClick={() => setStepperStep(s => s + 1)}
                  className="rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  Continue
                </button>
              ) : (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleCreateInvoice()}
                  className="rounded-xl bg-blue-600 px-6 py-2 text-xs font-bold text-white shadow-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {busy ? "Generating..." : "Confirm & Issue Invoice"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* PAYMENT DRAWER / MODAL */}
      {showPaymentDrawer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800">
              <h3 className="font-extrabold text-slate-900 dark:text-white">Record Fee Payment</h3>
              <button type="button" aria-label="Close payment form" onClick={() => setShowPaymentDrawer(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            {paymentSuccess ? (
              <div className="p-8 text-center space-y-4">
                <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-100 text-emerald-600 animate-in zoom-in-75 duration-300">
                  <CheckCircle2 size={36} />
                </div>
                <h4 className="text-xl font-black text-slate-900 dark:text-white">Payment Recorded Successfully</h4>
                <p className="text-xs text-slate-500">
                  Receipt Number: <strong className="text-blue-600 font-bold">{paymentSuccess.receiptNo}</strong>
                </p>

                <div className="pt-4 flex flex-col sm:flex-row gap-2 justify-center">
                  <a
                    href={`/api/finance/payments/${paymentSuccess.id}/pdf`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-blue-700"
                  >
                    <Download size={14} />
                    <span>Download PDF Receipt</span>
                  </a>
                  <button
                    onClick={() => {
                      setPaymentSuccess(null);
                      setPayAmount("");
                      setMpesaCode("");
                    }}
                    className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300"
                  >
                    Record Another
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleRecordPayment} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Select Invoice</label>
                  <select
                    value={selectedInvoice?.id || ""}
                    onChange={e => {
                      const found = invoices.find(i => i.id === e.target.value);
                      setSelectedInvoice(found || null);
                      if (found) setPayAmount(String(found.balance));
                    }}
                    className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-800 dark:bg-slate-900"
                  >
                    {invoices.map(i => (
                      <option key={i.id} value={i.id}>
                        {i.learner.name} · {i.term} · Balance: {kes(i.balance)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Amount (KES)</label>
                    <input
                      required
                      type="number"
                      min="1"
                      value={payAmount}
                      onChange={e => setPayAmount(e.target.value)}
                      className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-bold dark:border-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Method</label>
                    <select
                      value={payMethod}
                      onChange={e => setPayMethod(e.target.value)}
                      className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-800"
                    >
                      <option value="MPESA">M-Pesa</option>
                      <option value="CASH">Cash</option>
                      <option value="BANK">Bank Deposit</option>
                      <option value="CHEQUE">Cheque</option>
                    </select>
                  </div>
                </div>

                {payMethod === "MPESA" && (
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                      M-Pesa Transaction Code
                    </label>
                    <input
                      required
                      minLength={8}
                      maxLength={20}
                      placeholder="e.g. QWE789RTY2"
                      value={mpesaCode}
                      onChange={e => setMpesaCode(e.target.value.toUpperCase())}
                      className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-bold uppercase tracking-wider dark:border-slate-800"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Reference / Notes</label>
                  <input
                    placeholder="Optional bank slip or payer name"
                    value={payRef}
                    onChange={e => setPayRef(e.target.value)}
                    className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 px-3 text-sm dark:border-slate-800"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-3">
                  <button
                    type="button"
                    onClick={() => setShowPaymentDrawer(false)}
                    className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={busy || !selectedInvoice || Number(payAmount) <= 0}
                    className="rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white shadow-md hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {busy ? "Recording..." : "Confirm & Issue Receipt"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* WAIVER MODAL */}
      {showWaiverModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-slate-900 dark:text-white">Request Fee Waiver / Discount</h3>
              <button type="button" aria-label="Close fee waiver request" onClick={() => setShowWaiverModal(false)} className="text-slate-400">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleRequestWaiver} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Waiver Amount (KES)</label>
                <input
                  required
                  type="number"
                  min="1"
                  value={waiverAmount}
                  onChange={e => setWaiverAmount(e.target.value)}
                  placeholder="e.g. 5000"
                  className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-bold dark:border-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Reason</label>
                <textarea
                  required
                  rows={3}
                  value={waiverReason}
                  onChange={e => setWaiverReason(e.target.value)}
                  placeholder="State ground for discount (e.g. Sibling discount, bursary grant)..."
                  className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-sm dark:border-slate-800"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowWaiverModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-700"
                >
                  Submit Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
