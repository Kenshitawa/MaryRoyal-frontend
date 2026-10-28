"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Wallet, Plus, Search, CheckCircle2, Download, X, ChevronRight
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

const kes = (n: number) =>
  new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(n);

export default function FinanceClient({
  canInvoice,
  canPay,
  canApprove,
  canVoid
}: {
  canInvoice: boolean;
  canPay: boolean;
  canApprove: boolean;
  canVoid: boolean;
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
        fetch("/api/learners?take=200"),
        fetch("/api/finance/structures"),
        fetch("/api/finance/waivers")
      ]);

      if (invRes.ok) setInvoices((await invRes.json()).invoices || []);
      if (learnRes.ok) setLearners((await learnRes.json()).learners || []);
      if (structRes.ok) setStructures((await structRes.json()).structures || []);
      if (waiverRes.ok) setWaivers((await waiverRes.json()).waivers || []);
    } catch {
      // fallback
    }
  }, []);

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

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Finance &amp; Accounts Desk
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Term invoicing, KES fee collection, M-Pesa receipts with QR verification, and arrears aging.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/finance/structures"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
          >
            <span>Fee Structures</span>
            <ChevronRight size={14} />
          </Link>

          {canInvoice && (
            <button
              onClick={() => {
                setShowInvoiceStepper(true);
                setStepperStep(1);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-700 active:scale-95"
            >
              <Plus size={16} />
              <span>Create Invoice (Stepper)</span>
            </button>
          )}

          {canPay && (
            <button
              onClick={() => {
                setSelectedInvoice(invoices[0] || null);
                setShowPaymentDrawer(true);
                setPaymentSuccess(null);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 active:scale-95"
            >
              <Wallet size={16} />
              <span>Record Payment</span>
            </button>
          )}
        </div>
      </div>

      {message && (
        <div role="status" className="rounded-xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
          {message}
        </div>
      )}
      {error && (
        <div role="alert" className="rounded-xl bg-rose-50 p-4 text-sm font-semibold text-rose-800 dark:bg-rose-950/40 dark:text-rose-200">
          {error}
        </div>
      )}

      {/* KPI Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ThemedCard className="p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Invoiced</p>
          <p className="mt-2 text-2xl font-extrabold text-slate-900 dark:text-white">{kes(totalBilled)}</p>
          <p className="mt-1 text-xs text-slate-500">{invoices.length} learner invoices</p>
        </ThemedCard>

        <ThemedCard className="p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Collected</p>
          <p className="mt-2 text-2xl font-extrabold text-emerald-700 dark:text-emerald-300">{kes(totalCollected)}</p>
          <p className="mt-1 text-xs text-slate-500">{collectionRate}% collection target</p>
        </ThemedCard>

        <ThemedCard className="p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-rose-500">Outstanding Arrears</p>
          <p className="mt-2 text-2xl font-extrabold text-rose-700 dark:text-rose-300">{kes(totalOutstanding)}</p>
          <p className="mt-1 text-xs text-slate-500">Pending recovery</p>
        </ThemedCard>

        <ThemedCard className="p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-blue-600">Collection Rate</p>
          <p className="mt-2 text-2xl font-extrabold text-blue-800 dark:text-blue-300">{collectionRate}%</p>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div className="h-full bg-blue-600 rounded-full" style={{ width: `${collectionRate}%` }} />
          </div>
        </ThemedCard>
      </div>

      {/* Tabs navigation */}
      <div className="flex gap-2 border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setActiveTab("invoices")}
          className={`pb-3 text-xs font-bold uppercase tracking-wider transition ${
            activeTab === "invoices"
              ? "border-b-2 border-blue-600 text-blue-600 dark:text-blue-400"
              : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          Invoices &amp; Receipts ({invoices.length})
        </button>
        <button
          onClick={() => setActiveTab("arrears")}
          className={`pb-3 text-xs font-bold uppercase tracking-wider transition ${
            activeTab === "arrears"
              ? "border-b-2 border-blue-600 text-blue-600 dark:text-blue-400"
              : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          Aging &amp; Arrears Buckets
        </button>
        <button
          onClick={() => setActiveTab("waivers")}
          className={`pb-3 text-xs font-bold uppercase tracking-wider transition ${
            activeTab === "waivers"
              ? "border-b-2 border-blue-600 text-blue-600 dark:text-blue-400"
              : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          Discounts &amp; Waivers ({waivers.length})
        </button>
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
                placeholder="Search by learner name, admission no, or class..."
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

          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50/70 text-xs uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800/40">
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
                    const latestPayment = inv.payments[0];
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
                        <td className="px-4 py-3.5 max-w-xs">
                          <div className="flex flex-wrap gap-1">
                            {inv.lines.map(l => (
                              <span
                                key={l.id}
                                className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                              >
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
                        <td className="px-4 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {canPay && inv.balance > 0 && (
                              <button
                                onClick={() => {
                                  setSelectedInvoice(inv);
                                  setPayAmount(String(inv.balance));
                                  setShowPaymentDrawer(true);
                                  setPaymentSuccess(null);
                                }}
                                className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-emerald-700 shadow-sm"
                              >
                                Pay
                              </button>
                            )}

                            {canApprove && latestPayment?.status === "PENDING" && (
                              <button
                                onClick={() => void confirmPayment(latestPayment)}
                                className="rounded-lg bg-blue-700 px-2.5 py-1 text-xs font-bold text-white hover:bg-blue-800"
                              >
                                Confirm payment
                              </button>
                            )}

                            {canVoid && latestPayment && latestPayment.status !== "VOIDED" && (
                              <button
                                onClick={() => void voidPayment(latestPayment)}
                                className="rounded-lg border border-rose-200 px-2.5 py-1 text-xs font-bold text-rose-700 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950/30"
                              >
                                Void
                              </button>
                            )}

                            {inv.payments.length > 0 && (
                              <a
                                href={`/api/finance/payments/${inv.payments[0].id}/pdf`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300"
                                title="Download official PDF receipt with verification QR code"
                              >
                                <Download size={13} />
                                <span>Receipt PDF</span>
                              </a>
                            )}

                            {canInvoice && (
                              <button
                                onClick={() => {
                                  setWaiverInvoiceId(inv.id);
                                  setShowWaiverModal(true);
                                }}
                                className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700"
                                title="Request fee discount or waiver"
                              >
                                Discount
                              </button>
                            )}
                          </div>
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
