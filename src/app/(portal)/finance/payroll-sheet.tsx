"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Check,
  CheckCircle2,
  Clock,
  Plus,
  Search,
  Wallet,
} from "lucide-react";

type Staff = { id: string; name: string };
type Entry = {
  id: string;
  period: string;
  grossAmount: number;
  deductions: number;
  netAmount: number;
  status: string;
  reference: string | null;
  paidAt: string | null;
  staff: Staff;
};

const kes = (amount: number) =>
  new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 0,
  }).format(amount);

const currentPeriod = () =>
  new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    timeZone: "Africa/Nairobi",
  }).format(new Date());

export default function PayrollSheet({
  canManage,
  canApprove,
}: {
  canManage: boolean;
  canApprove: boolean;
}) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [staffId, setStaffId] = useState("");
  const [period, setPeriod] = useState(currentPeriod());
  const [gross, setGross] = useState("");
  const [deductions, setDeductions] = useState("0");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState("");

  const refresh = useCallback(async () => {
    const response = await fetch("/api/finance/payroll");
    if (!response.ok) {
      setMessage("Payroll records could not be loaded.");
      return;
    }
    const data = await response.json();
    setEntries(data.entries);
    setStaff(data.staff);
    setStaffId((current) => current || data.staff[0]?.id || "");
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/finance/payroll", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          staffId,
          period,
          grossAmount: Number(gross),
          deductions: Number(deductions),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setMessage("Payroll entry recorded and audited.");
      setGross("");
      setDeductions("0");
      setShowAdd(false);
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Payroll entry could not be created.");
    } finally {
      setBusy(false);
    }
  }

  async function markPaid(entry: Entry) {
    const reference = window.prompt("Payment disbursement reference (e.g. Bank slip or M-Pesa ref):") ?? undefined;
    if (reference === undefined) return;
    setBusy(true);
    try {
      const response = await fetch("/api/finance/payroll", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: entry.id, action: "mark-paid", reference }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setMessage(`${entry.staff.name} marked as paid. Recorded in audit ledger.`);
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Payroll status could not be updated.");
    } finally {
      setBusy(false);
    }
  }

  const filteredEntries = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter(
      (e) =>
        e.staff.name.toLowerCase().includes(q) ||
        e.period.toLowerCase().includes(q) ||
        (e.reference && e.reference.toLowerCase().includes(q))
    );
  }, [entries, search]);

  // Aggregate metrics
  const totalGross = entries.reduce((s, e) => s + e.grossAmount, 0);
  const totalDeductions = entries.reduce((s, e) => s + e.deductions, 0);
  const totalNet = entries.reduce((s, e) => s + e.netAmount, 0);
  const pendingCount = entries.filter((e) => e.status === "PENDING").length;

  return (
    <section className="mx-auto mt-8 max-w-7xl px-4 md:px-8">
      <div className="glass dark:glass-dark rounded-3xl border border-slate-200/80 p-6 shadow-sm sm:p-7 dark:border-slate-800/80">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-blue-50 text-blue-700 shadow-sm dark:bg-blue-950/60 dark:text-blue-400">
              <Wallet size={20} />
            </span>
            <div>
              <h2 className="text-xl font-black tracking-tight text-slate-900 dark:text-white">
                Faculty & Staff Payroll
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Monthly remuneration, statutory deductions, and leadership disbursements · KES
              </p>
            </div>
          </div>

          {canManage && (
            <button
              onClick={() => setShowAdd(!showAdd)}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-blue-700 px-5 text-xs font-bold text-white shadow-sm transition hover:bg-blue-800 active:scale-95"
            >
              <Plus size={15} />
              {showAdd ? "Close Entry Form" : "Record Payroll Entry"}
            </button>
          )}
        </div>

        {/* Bento Stats */}
        <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-900/40">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Total Gross Pay
            </span>
            <p className="mt-1 text-xl font-black text-slate-900 dark:text-white">
              {kes(totalGross)}
            </p>
            <p className="mt-0.5 text-[10px] text-slate-400">Pre-deductions</p>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-900/40">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Total Deductions
            </span>
            <p className="mt-1 text-xl font-black text-slate-700 dark:text-slate-300">
              {kes(totalDeductions)}
            </p>
            <p className="mt-0.5 text-[10px] text-slate-400">PAYE, NSSF, NHIF</p>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-900/40">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Net Disbursement
            </span>
            <p className="mt-1 text-xl font-black text-emerald-700 dark:text-emerald-400">
              {kes(totalNet)}
            </p>
            <p className="mt-0.5 text-[10px] text-slate-400">Actual payouts</p>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-900/40">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Pending Authorization
            </span>
            <p className="mt-1 text-xl font-black text-amber-600 dark:text-amber-400">
              {pendingCount}
            </p>
            <p className="mt-0.5 text-[10px] text-slate-400">Awaiting Director approval</p>
          </div>
        </div>

        {message && (
          <div
            role="status"
            className="mt-5 rounded-2xl border border-blue-200 bg-blue-50/80 p-3.5 text-xs font-semibold text-blue-900 dark:border-blue-800/60 dark:bg-blue-950/40 dark:text-blue-300"
          >
            {message}
          </div>
        )}

        {/* Add Entry Form (Bento Expandable) */}
        {canManage && showAdd && (
          <form
            onSubmit={create}
            className="mt-6 rounded-2xl border border-blue-200/80 bg-blue-50/30 p-5 dark:border-blue-900/50 dark:bg-blue-950/20"
          >
            <p className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
              Add Staff Pay Slip
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Staff Member
                </label>
                <select
                  required
                  value={staffId}
                  onChange={(e) => setStaffId(e.target.value)}
                  className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-900 outline-none focus:border-blue-600 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                >
                  {staff.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Pay Period (Month)
                </label>
                <input
                  required
                  type="month"
                  value={period}
                  onChange={(e) => setPeriod(e.target.value)}
                  className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-900 outline-none focus:border-blue-600 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Gross Pay (KES)
                </label>
                <input
                  required
                  type="number"
                  min="1"
                  step="1"
                  placeholder="e.g. 45000"
                  value={gross}
                  onChange={(e) => setGross(e.target.value)}
                  className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-900 outline-none focus:border-blue-600 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Deductions (KES)
                </label>
                <input
                  required
                  type="number"
                  min="0"
                  step="1"
                  placeholder="0"
                  value={deductions}
                  onChange={(e) => setDeductions(e.target.value)}
                  className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-900 outline-none focus:border-blue-600 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                />
              </div>

              <div className="flex items-end">
                <button
                  disabled={busy || !staffId}
                  className="inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-blue-700 px-4 text-xs font-bold text-white shadow-sm transition hover:bg-blue-800 disabled:opacity-50"
                >
                  <Plus size={14} />
                  Record Entry
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Payroll Table */}
        <div className="mt-6">
          <div className="flex items-center justify-between pb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Payroll Register ({filteredEntries.length})
            </h3>

            <div className="relative w-64">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500"
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search staff or month…"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/70 py-1.5 pl-8 pr-3 text-xs font-medium text-slate-900 outline-none focus:border-blue-600 focus:bg-white dark:border-slate-700 dark:bg-slate-900/60 dark:text-white"
              />
            </div>
          </div>

          {!filteredEntries.length ? (
            <p className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
              No payroll entries registered for this school yet.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-200/80 dark:border-slate-800">
              <table className="w-full min-w-[700px] text-left text-xs">
                <thead>
                  <tr className="bg-slate-50/80 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:bg-slate-900/80 dark:text-slate-400">
                    <th className="px-5 py-3.5">Month</th>
                    <th className="px-5 py-3.5">Staff Member</th>
                    <th className="px-5 py-3.5">Gross Pay</th>
                    <th className="px-5 py-3.5">Deductions</th>
                    <th className="px-5 py-3.5">Net Payout</th>
                    <th className="px-5 py-3.5">Status</th>
                    {(canManage || canApprove) && <th className="px-5 py-3.5">Action</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {filteredEntries.map((entry) => (
                    <tr
                      key={entry.id}
                      className="transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-900/40"
                    >
                      <td className="px-5 py-4 font-mono font-medium text-slate-900 dark:text-white">
                        {entry.period}
                      </td>
                      <td className="px-5 py-4 font-bold text-slate-900 dark:text-white">
                        {entry.staff.name}
                      </td>
                      <td className="px-5 py-4 font-semibold text-slate-600 dark:text-slate-300">
                        {kes(entry.grossAmount)}
                      </td>
                      <td className="px-5 py-4 font-semibold text-red-600 dark:text-red-400">
                        {kes(entry.deductions)}
                      </td>
                      <td className="px-5 py-4 font-black text-emerald-700 dark:text-emerald-400">
                        {kes(entry.netAmount)}
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                            entry.status === "PAID"
                              ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                              : "bg-amber-50 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300"
                          }`}
                        >
                          {entry.status === "PAID" ? (
                            <CheckCircle2 size={11} />
                          ) : (
                            <Clock size={11} />
                          )}
                          {entry.status}
                        </span>
                        {entry.reference && (
                          <span className="ml-2 font-mono text-[10px] text-slate-400">
                            Ref: {entry.reference}
                          </span>
                        )}
                      </td>
                      {(canManage || canApprove) && (
                        <td className="px-5 py-4">
                          {canApprove && entry.status === "PENDING" && (
                            <button
                              disabled={busy}
                              onClick={() => void markPaid(entry)}
                              className="inline-flex min-h-8 items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 text-xs font-bold text-emerald-800 transition hover:bg-emerald-100 disabled:opacity-50 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                            >
                              <Check size={13} />
                              Disburse & Mark Paid
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
