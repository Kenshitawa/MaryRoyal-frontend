"use client";

import { useCallback, useEffect, useState } from "react";
import {
  HeartHandshake, TrendingUp, PiggyBank, CreditCard, Plus, AlertCircle,
  CheckCircle2, Users, ChevronDown, ChevronUp, Banknote, Gift, X, Loader2
} from "lucide-react";

type WelfareMember = {
  id: string;
  userId: string;
  totalSavings: number;
  joinedAt: string;
  active: boolean;
  user: { id: string; name: string; role: string; employmentTitle: string | null };
  contributions: WelfareContribution[];
  loans: WelfareLoan[];
};

type WelfareContribution = {
  id: string;
  memberId: string;
  month: number;
  year: number;
  amount: number;
  category: string;
  productTitle: string | null;
  receiptRef: string | null;
  notes: string | null;
  createdAt: string;
};

type WelfareLoan = {
  id: string;
  type: string;
  principalAmount: number;
  repaymentTermMonths: number;
  monthlyDeduction: number;
  status: string;
  repaidAmount: number;
  purpose: string | null;
  headteacherNotes: string | null;
  directorNotes: string | null;
  disbursedAt: string | null;
  createdAt: string;
};

type WelfareProduct = {
  id: string;
  title: string;
  description: string;
  targetAmount: number;
  monthlyAmount: number | null;
  status: string;
};
type WelfareRank = { rank: number; name: string; role: string };

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const STATUS_COLORS: Record<string, string> = {
  PENDING_HEADTEACHER: "bg-amber-100 text-amber-800",
  PENDING_DIRECTOR: "bg-blue-100 text-blue-800",
  APPROVED: "bg-emerald-100 text-emerald-800",
  DISBURSED: "bg-emerald-100 text-emerald-800",
  REJECTED: "bg-rose-100 text-rose-800",
  PAID: "bg-slate-100 text-slate-600",
};

const STATUS_LABELS: Record<string, string> = {
  PENDING_HEADTEACHER: "Awaiting Head Teacher",
  PENDING_DIRECTOR: "Awaiting Director",
  APPROVED: "Approved",
  DISBURSED: "Disbursed",
  REJECTED: "Rejected",
  PAID: "Paid",
};

function fmt(n: number) { return `KES ${n.toLocaleString()}`; }

export default function WelfareClient({ role }: { role: string; userId?: string; userName?: string }) {
  const isAdmin = ["DIRECTOR", "HEAD_TEACHER", "WELFARE_CHAIR"].includes(role);
  const canApprove = ["HEAD_TEACHER", "DIRECTOR"].includes(role);
  const canCreate = ["WELFARE_CHAIR", "DIRECTOR"].includes(role);

  const [members, setMembers] = useState<WelfareMember[]>([]);
  const [products, setProducts] = useState<WelfareProduct[]>([]);
  const [leaderboard, setLeaderboard] = useState<WelfareRank[]>([]);
  const [myMember, setMyMember] = useState<WelfareMember | null>(null);
  const [tab, setTab] = useState<"my-welfare" | "overview" | "loans" | "products">("my-welfare");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [expandedMember, setExpandedMember] = useState<string | null>(null);

  // Forms
  const [showContrib, setShowContrib] = useState(false);
  const [showLoan, setShowLoan] = useState(false);
  const [showProduct, setShowProduct] = useState(false);
  const [showEnroll, setShowEnroll] = useState(false);
  const [contribForm, setContribForm] = useState({ memberId: "", month: new Date().getMonth() + 1, year: new Date().getFullYear(), amount: "", category: "MONTHLY_SAVINGS", productTitle: "", receiptRef: "", notes: "" });
  const [loanForm, setLoanForm] = useState({ memberId: "", type: "LOAN", principalAmount: "", repaymentTermMonths: "12", purpose: "" });
  const [productForm, setProductForm] = useState({ title: "", description: "", targetAmount: "", monthlyAmount: "" });
  const [enrollUserId, setEnrollUserId] = useState("");
  const [allStaff, setAllStaff] = useState<{ id: string; name: string; role: string }[]>([]);

  const load = useCallback(async () => {
    try {
      if (isAdmin && ["DIRECTOR", "WELFARE_CHAIR", "HEAD_TEACHER"].includes(role)) {
        const res = await fetch("/api/welfare?scope=overview");
        if (res.ok) {
          const data = await res.json();
          setMembers(data.members ?? []);
          setProducts(data.products ?? []);
        }
      }
      // Always load own member record
      const selfRes = await fetch("/api/welfare");
      if (selfRes.ok) {
        const selfData = await selfRes.json();
        setMyMember(selfData.member);
        if (!isAdmin || role === "NON_TEACHING_STAFF") setProducts(selfData.products ?? []);
      }
      const ranksRes = await fetch("/api/welfare?scope=leaderboard");
      if (ranksRes.ok) setLeaderboard((await ranksRes.json()).leaderboard ?? []);
    } catch { /* ignore */ }
  }, [isAdmin, role]);

  const loadStaff = useCallback(async () => {
    try {
      const res = await fetch("/api/accounts");
      if (res.ok) {
        const data = await res.json();
        setAllStaff((data.accounts ?? []).filter((a: { role: string }) =>
          !["PARENT", "LEARNER"].includes(a.role)
        ));
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (canCreate) void loadStaff(); }, [canCreate, loadStaff]);

  function notify(text: string, ok = true) { setMsg({ text, ok }); setTimeout(() => setMsg(null), 4000); }

  async function apiPost(body: Record<string, unknown>) {
    setBusy(true);
    try {
      const res = await fetch("/api/welfare", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) { notify(data.error ?? "Error occurred", false); return false; }
      return true;
    } finally { setBusy(false); }
  }

  async function apiPatch(body: Record<string, unknown>) {
    setBusy(true);
    try {
      const res = await fetch("/api/welfare", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) { notify(data.error ?? "Error occurred", false); return false; }
      return true;
    } finally { setBusy(false); }
  }

  async function handleContrib(e: React.FormEvent) {
    e.preventDefault();
    const ok = await apiPost({ _action: "contribution", ...contribForm, month: Number(contribForm.month), year: Number(contribForm.year), amount: Number(contribForm.amount) });
    if (ok) { notify("Contribution recorded!"); setShowContrib(false); void load(); }
  }

  async function handleLoan(e: React.FormEvent) {
    e.preventDefault();
    const memberId = loanForm.memberId || myMember?.id;
    if (!memberId) { notify("Select a member or enroll first.", false); return; }
    const ok = await apiPost({ _action: "loan", ...loanForm, memberId, principalAmount: Number(loanForm.principalAmount), repaymentTermMonths: Number(loanForm.repaymentTermMonths) });
    if (ok) { notify("Application submitted!"); setShowLoan(false); void load(); }
  }

  async function handleProduct(e: React.FormEvent) {
    e.preventDefault();
    const ok = await apiPost({ _action: "product", ...productForm, targetAmount: Number(productForm.targetAmount), monthlyAmount: productForm.monthlyAmount ? Number(productForm.monthlyAmount) : undefined });
    if (ok) { notify("Product created!"); setShowProduct(false); void load(); }
  }

  async function handleEnroll(e: React.FormEvent) {
    e.preventDefault();
    const ok = await apiPost({ _action: "enroll", userId: enrollUserId });
    if (ok) { notify("Member enrolled!"); setShowEnroll(false); setEnrollUserId(""); void load(); }
  }

  async function handleLoanAction(loanId: string, action: string, notes?: string) {
    const ok = await apiPatch({ loanId, action, notes });
    if (ok) { notify(action === "reject" ? "Application rejected." : "Done!"); void load(); }
  }

  const pendingLoans = members.flatMap((m) => m.loans.filter((l) => l.status === "PENDING_HEADTEACHER" || l.status === "PENDING_DIRECTOR")).map((l) => {
    const m = members.find((mb) => mb.loans.some((ml) => ml.id === l.id));
    return { ...l, memberName: m?.user.name ?? "Unknown" };
  });

  // Self member card
  const selfTotalSavings = myMember?.totalSavings ?? 0;
  const selfLoanLimit = Math.floor(selfTotalSavings * 0.6);
  const selfActiveLoans = myMember?.loans.filter((l) => !["REJECTED", "PAID"].includes(l.status)) ?? [];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-10">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <HeartHandshake size={26} className="text-rose-600" /> Staff Welfare
          </h1>
          <p className="mt-1 text-sm text-slate-500">Mary Royal School — Teachers &amp; Staff Welfare Programme</p>
        </div>
        {canCreate && (
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setShowEnroll(true)} className="flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 shadow-sm">
              <Plus size={15} /> Enroll Member
            </button>
          </div>
        )}
      </div>

      {msg && (
        <div className={`mb-4 rounded-xl p-3 text-sm font-semibold ${msg.ok ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800"}`}>
          {msg.text}
        </div>
      )}

      {/* Tabs */}
      <div className="mb-6 flex gap-1 rounded-2xl bg-slate-100/80 p-1 dark:bg-slate-800">
        {[
          { key: "my-welfare", label: "My Welfare", icon: PiggyBank },
          ...(["DIRECTOR", "WELFARE_CHAIR", "HEAD_TEACHER"].includes(role) ? [{ key: "overview", label: "All Members", icon: Users }] : []),
          { key: "loans", label: "Loans & Advances", icon: CreditCard },
          { key: "products", label: "Welfare Products", icon: Gift },
        ].map(({ key, label, icon: Icon }) => (
          <button key={key} aria-label={label} onClick={() => setTab(key as typeof tab)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition ${tab === key ? "bg-white text-blue-800 shadow-sm dark:bg-slate-700 dark:text-blue-300" : "text-slate-500 hover:text-slate-700"}`}>
            <Icon size={15} /><span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {/* My Welfare Tab */}
      {tab === "my-welfare" && (
        <div className="space-y-6">
          {leaderboard.length > 0 && <section className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"><h2 className="font-bold text-slate-900 dark:text-white">Welfare champions</h2><p className="mt-1 text-xs text-slate-500">Members with the most contributions. Individual contribution amounts are private.</p><ol className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{leaderboard.map((item) => <li key={item.rank} className="flex items-center gap-3 rounded-xl bg-blue-50/70 p-3 dark:bg-slate-800"><span className="grid h-8 w-8 place-items-center rounded-full bg-blue-700 text-xs font-bold text-white">{item.rank}</span><span><span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">{item.name}</span><span className="text-[11px] text-slate-500">{item.role.replaceAll("_", " ")}</span></span></li>)}</ol></section>}
          {!myMember ? (
            <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center">
              <HeartHandshake size={32} className="mx-auto mb-3 text-slate-300" />
              <p className="text-sm font-semibold text-slate-600">You are not yet enrolled in the Welfare programme.</p>
              <p className="mt-1 text-xs text-slate-400">Contact the Welfare Chair or Director to get enrolled.</p>
            </div>
          ) : (
            <>
              {/* Stats cards */}
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 p-5 text-white shadow-lg">
                  <p className="text-xs font-semibold opacity-80">Total Savings</p>
                  <p className="mt-2 text-2xl font-extrabold">{fmt(selfTotalSavings)}</p>
                  <p className="mt-1 text-xs opacity-70">Loan limit: {fmt(selfLoanLimit)}</p>
                </div>
                <div className="rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 p-5 text-white shadow-lg">
                  <p className="text-xs font-semibold opacity-80">Active Loans</p>
                  <p className="mt-2 text-2xl font-extrabold">{selfActiveLoans.length}</p>
                  <p className="mt-1 text-xs opacity-70">{selfActiveLoans.length ? `KES ${selfActiveLoans.reduce((a, l) => a + l.principalAmount - l.repaidAmount, 0).toLocaleString()} outstanding` : "No active loans"}</p>
                </div>
                <div className="rounded-2xl bg-gradient-to-br from-rose-400 to-rose-600 p-5 text-white shadow-lg">
                  <p className="text-xs font-semibold opacity-80">Contributions</p>
                  <p className="mt-2 text-2xl font-extrabold">{myMember.contributions.length}</p>
                  <p className="mt-1 text-xs opacity-70">Total records</p>
                </div>
              </div>

              {/* Apply buttons */}
              <div className="flex flex-wrap gap-3">
                <button onClick={() => { setLoanForm((f) => ({ ...f, memberId: myMember.id, type: "LOAN" })); setShowLoan(true); }}
                  className="flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-semibold text-blue-800 hover:bg-blue-100">
                  <Banknote size={15} /> Apply for Loan
                </button>
                <button onClick={() => { setLoanForm((f) => ({ ...f, memberId: myMember.id, type: "SALARY_ADVANCE" })); setShowLoan(true); }}
                  className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-800 hover:bg-emerald-100">
                  <CreditCard size={15} /> Salary Advance
                </button>
              </div>

              {/* Contributions */}
              <div>
                <h2 className="mb-3 font-bold text-slate-800 dark:text-white flex items-center gap-2"><TrendingUp size={16}/> Contribution History</h2>
                {myMember.contributions.length === 0 ? (
                  <p className="text-sm text-slate-400">No contributions recorded yet.</p>
                ) : (
                  <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 dark:bg-slate-800">
                        <tr>
                          {["Period", "Type", "Amount", "Ref", "Notes"].map((h) => (
                            <th key={h} className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {myMember.contributions.map((c) => (
                          <tr key={c.id} className="border-t border-slate-100 dark:border-slate-800">
                            <td className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-200">{MONTHS[c.month - 1]} {c.year}</td>
                            <td className="px-4 py-3 text-slate-600">{c.category === "MONTHLY_SAVINGS" ? "Monthly Savings" : c.productTitle ?? "Product"}</td>
                            <td className="px-4 py-3 font-bold text-emerald-700">{fmt(c.amount)}</td>
                            <td className="px-4 py-3 text-slate-400 text-xs">{c.receiptRef ?? "—"}</td>
                            <td className="px-4 py-3 text-slate-400 text-xs">{c.notes ?? "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Loans */}
              {myMember.loans.length > 0 && (
                <div>
                  <h2 className="mb-3 font-bold text-slate-800 dark:text-white flex items-center gap-2"><CreditCard size={16}/> My Loans &amp; Advances</h2>
                  <div className="space-y-3">
                    {myMember.loans.map((l) => (
                      <div key={l.id} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-bold text-slate-900 dark:text-white">{l.type === "SALARY_ADVANCE" ? "Salary Advance" : "Loan"} — {fmt(l.principalAmount)}</p>
                            <p className="text-xs text-slate-500">{new Date(l.createdAt).toLocaleDateString("en-KE", { day: "numeric", month: "long", year: "numeric" })}</p>
                          </div>
                          <span className={`rounded-full px-3 py-1 text-xs font-bold ${STATUS_COLORS[l.status] ?? "bg-slate-100 text-slate-600"}`}>{STATUS_LABELS[l.status] ?? l.status}</span>
                        </div>
                        {l.purpose && <p className="mt-2 text-xs text-slate-500">Purpose: {l.purpose}</p>}
                        <p className="mt-1 text-xs text-slate-400">Monthly deduction: {fmt(l.monthlyDeduction)} over {l.repaymentTermMonths} month(s)</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Overview Tab (Admin) */}
      {tab === "overview" && ["DIRECTOR", "WELFARE_CHAIR", "HEAD_TEACHER"].includes(role) && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{members.length} enrolled member(s)</p>
            {canCreate && (
              <button onClick={() => setShowContrib(true)} className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
                <Plus size={14}/> Record Contribution
              </button>
            )}
          </div>
          {members.map((m) => (
            <div key={m.id} className="rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              <button onClick={() => setExpandedMember(expandedMember === m.id ? null : m.id)} className="flex w-full items-center justify-between px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-800">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-800">
                    {m.user.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-slate-900 dark:text-white">{m.user.name}</p>
                    <p className="text-xs text-slate-500">{m.user.role.replace(/_/g, " ")} · Savings: {fmt(m.totalSavings)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="hidden rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700 sm:inline">{fmt(m.totalSavings)}</span>
                  {expandedMember === m.id ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
                </div>
              </button>
              {expandedMember === m.id && (
                <div className="border-t border-slate-100 px-5 pb-5 pt-4 dark:border-slate-800">
                  <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">Recent Contributions</p>
                  {m.contributions.length === 0 ? <p className="text-sm text-slate-400">No contributions yet.</p> : (
                    <div className="space-y-2">
                      {m.contributions.slice(0, 6).map((c) => (
                        <div key={c.id} className="flex items-center justify-between text-sm">
                          <span className="text-slate-600">{MONTHS[c.month - 1]} {c.year} — {c.category === "MONTHLY_SAVINGS" ? "Savings" : c.productTitle}</span>
                          <span className="font-bold text-emerald-700">{fmt(c.amount)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Loans Tab */}
      {tab === "loans" && (
        <div className="space-y-6">
          {canApprove && pendingLoans.length > 0 && (
            <div>
              <h2 className="mb-3 font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <AlertCircle size={16} className="text-amber-500"/> Pending Approvals ({pendingLoans.length})
              </h2>
              <div className="space-y-3">
                {pendingLoans.map((l) => (
                  <div key={l.id} className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:bg-amber-950/20">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-bold text-slate-900">{l.memberName} — {l.type === "SALARY_ADVANCE" ? "Salary Advance" : "Loan"}</p>
                        <p className="text-sm text-slate-600">{fmt(l.principalAmount)} over {l.repaymentTermMonths} month(s) · Monthly: {fmt(l.monthlyDeduction)}</p>
                        {l.purpose && <p className="mt-1 text-xs text-slate-500">Purpose: {l.purpose}</p>}
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-bold ${STATUS_COLORS[l.status]}`}>{STATUS_LABELS[l.status]}</span>
                    </div>
                    {((l.status === "PENDING_HEADTEACHER" && (role === "HEAD_TEACHER" || role === "DIRECTOR")) ||
                      (l.status === "PENDING_DIRECTOR" && role === "DIRECTOR") ||
                      (l.status === "APPROVED" && (role === "WELFARE_CHAIR" || role === "DIRECTOR"))) && (
                      <div className="mt-3 flex gap-2">
                        {((l.status === "PENDING_HEADTEACHER" && (role === "HEAD_TEACHER" || role === "DIRECTOR")) ||
                          (l.status === "PENDING_DIRECTOR" && role === "DIRECTOR")) && (
                          <>
                            <button disabled={busy} onClick={() => handleLoanAction(l.id, "approve")} className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50">
                              <CheckCircle2 size={12}/> Approve
                            </button>
                            <button disabled={busy} onClick={() => { const notes = window.prompt("Reason for rejection (optional):"); void handleLoanAction(l.id, "reject", notes ?? undefined); }} className="flex items-center gap-1 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-rose-700 disabled:opacity-50">
                              <X size={12}/> Reject
                            </button>
                          </>
                        )}
                        {(role === "WELFARE_CHAIR" || role === "DIRECTOR") && l.status === "APPROVED" && (
                          <button disabled={busy} onClick={() => handleLoanAction(l.id, "disburse")} className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50">
                            <Banknote size={12}/> Disburse
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Apply loan form button for self */}
          {myMember && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-bold text-slate-800 dark:text-white">Apply for Loan or Advance</h2>
              </div>
              <div className="rounded-2xl border border-slate-200 p-5 dark:border-slate-700">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-xl bg-blue-50 p-4 dark:bg-blue-950/30">
                    <p className="text-xs font-bold text-blue-700 mb-1">Available Loan Limit</p>
                    <p className="text-xl font-extrabold text-blue-900 dark:text-blue-200">{fmt(selfLoanLimit)}</p>
                    <p className="text-xs text-blue-600 mt-1">60% of your {fmt(selfTotalSavings)} savings</p>
                    <button onClick={() => { setLoanForm((f) => ({ ...f, memberId: myMember.id, type: "LOAN" })); setShowLoan(true); }}
                      className="mt-3 w-full rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white hover:bg-blue-800">
                      Apply for Loan
                    </button>
                  </div>
                  <div className="rounded-xl bg-emerald-50 p-4 dark:bg-emerald-950/30">
                    <p className="text-xs font-bold text-emerald-700 mb-1">Salary Advance</p>
                    <p className="text-xl font-extrabold text-emerald-900 dark:text-emerald-200">Up to KES 3,000</p>
                    <p className="text-xs text-emerald-600 mt-1">Available from 15th of month</p>
                    <button onClick={() => { setLoanForm((f) => ({ ...f, memberId: myMember.id, type: "SALARY_ADVANCE" })); setShowLoan(true); }}
                      className="mt-3 w-full rounded-lg bg-emerald-700 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-800">
                      Request Advance
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Products Tab */}
      {tab === "products" && (
        <div className="space-y-4">
          {canCreate && (
            <div className="flex justify-end">
              <button onClick={() => setShowProduct(true)} className="flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700">
                <Plus size={14}/> New Product
              </button>
            </div>
          )}
          {products.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center">
              <Gift size={32} className="mx-auto mb-3 text-slate-300"/>
              <p className="text-sm text-slate-500">No welfare products created yet.</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {products.map((p) => (
                <div key={p.id} className="rounded-2xl border border-slate-200 p-5 dark:border-slate-700 hover:shadow-md transition">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-slate-900 dark:text-white">{p.title}</h3>
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">{p.status}</span>
                  </div>
                  <p className="mt-2 text-xs text-slate-500 leading-relaxed">{p.description}</p>
                  {p.targetAmount > 0 && <p className="mt-3 text-sm font-bold text-slate-700 dark:text-slate-300">Target: {fmt(p.targetAmount)}</p>}
                  {p.monthlyAmount && <p className="text-xs text-slate-500">Monthly contribution: {fmt(p.monthlyAmount)}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {showContrib && (
        <Modal title="Record Contribution" onClose={() => setShowContrib(false)}>
          <form onSubmit={handleContrib} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Member</label>
              <select value={contribForm.memberId} onChange={(e) => setContribForm((f) => ({ ...f, memberId: e.target.value }))} required className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Select member…</option>
                {members.map((m) => <option key={m.id} value={m.id}>{m.user.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Month</label>
                <select value={contribForm.month} onChange={(e) => setContribForm((f) => ({ ...f, month: Number(e.target.value) }))} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm">
                  {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Year</label>
                <input type="number" value={contribForm.year} onChange={(e) => setContribForm((f) => ({ ...f, year: Number(e.target.value) }))} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" required />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
              <select value={contribForm.category} onChange={(e) => setContribForm((f) => ({ ...f, category: e.target.value }))} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm">
                <option value="MONTHLY_SAVINGS">Monthly Savings</option>
                <option value="PRODUCT">Welfare Product</option>
              </select>
            </div>
            {contribForm.category === "PRODUCT" && (
              <Field label="Product Name" value={contribForm.productTitle} onChange={(v) => setContribForm((f) => ({ ...f, productTitle: v }))} />
            )}
            <Field label="Amount (KES)" type="number" value={contribForm.amount} onChange={(v) => setContribForm((f) => ({ ...f, amount: v }))} required />
            <Field label="Receipt Ref (optional)" value={contribForm.receiptRef} onChange={(v) => setContribForm((f) => ({ ...f, receiptRef: v }))} />
            <Field label="Notes (optional)" value={contribForm.notes} onChange={(v) => setContribForm((f) => ({ ...f, notes: v }))} />
            <button type="submit" disabled={busy} className="w-full rounded-xl bg-blue-700 py-2.5 text-sm font-bold text-white hover:bg-blue-800 disabled:opacity-50 flex items-center justify-center gap-2">
              {busy && <Loader2 size={14} className="animate-spin"/>} Record Contribution
            </button>
          </form>
        </Modal>
      )}

      {showLoan && (
        <Modal title={loanForm.type === "SALARY_ADVANCE" ? "Salary Advance Request" : "Loan Application"} onClose={() => setShowLoan(false)}>
          <form onSubmit={handleLoan} className="space-y-4">
            {loanForm.type === "SALARY_ADVANCE" ? (
              <div className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
                ⚡ Maximum KES 3,000 · Available from the 15th of the month
              </div>
            ) : (
              <div className="rounded-xl bg-blue-50 p-3 text-xs text-blue-800">
                💡 Maximum loan: 60% of your savings ({myMember ? fmt(Math.floor(myMember.totalSavings * 0.6)) : "—"})
              </div>
            )}
            <Field label="Amount (KES)" type="number" value={loanForm.principalAmount} onChange={(v) => setLoanForm((f) => ({ ...f, principalAmount: v }))} required />
            {loanForm.type === "LOAN" && (
              <Field label="Repayment Months" type="number" value={loanForm.repaymentTermMonths} onChange={(v) => setLoanForm((f) => ({ ...f, repaymentTermMonths: v }))} required />
            )}
            <Field label="Purpose (optional)" value={loanForm.purpose} onChange={(v) => setLoanForm((f) => ({ ...f, purpose: v }))} />
            <button type="submit" disabled={busy} className="w-full rounded-xl bg-blue-700 py-2.5 text-sm font-bold text-white hover:bg-blue-800 disabled:opacity-50 flex items-center justify-center gap-2">
              {busy && <Loader2 size={14} className="animate-spin"/>} Submit Application
            </button>
          </form>
        </Modal>
      )}

      {showProduct && (
        <Modal title="New Welfare Product" onClose={() => setShowProduct(false)}>
          <form onSubmit={handleProduct} className="space-y-4">
            <Field label="Product Title" value={productForm.title} onChange={(v) => setProductForm((f) => ({ ...f, title: v }))} required />
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
              <textarea value={productForm.description} onChange={(e) => setProductForm((f) => ({ ...f, description: e.target.value }))} required rows={3} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <Field label="Target Amount (KES)" type="number" value={productForm.targetAmount} onChange={(v) => setProductForm((f) => ({ ...f, targetAmount: v }))} />
            <Field label="Monthly Contribution (KES, optional)" type="number" value={productForm.monthlyAmount} onChange={(v) => setProductForm((f) => ({ ...f, monthlyAmount: v }))} />
            <button type="submit" disabled={busy} className="w-full rounded-xl bg-rose-600 py-2.5 text-sm font-bold text-white hover:bg-rose-700 disabled:opacity-50 flex items-center justify-center gap-2">
              {busy && <Loader2 size={14} className="animate-spin"/>} Create Product
            </button>
          </form>
        </Modal>
      )}

      {showEnroll && (
        <Modal title="Enroll New Member" onClose={() => setShowEnroll(false)}>
          <form onSubmit={handleEnroll} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Staff Member</label>
              <select value={enrollUserId} onChange={(e) => setEnrollUserId(e.target.value)} required className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Select staff…</option>
                {allStaff.filter((s) => !members.some((m) => m.userId === s.id)).map((s) => (
                  <option key={s.id} value={s.id}>{s.name} ({s.role.replace(/_/g, " ")})</option>
                ))}
              </select>
            </div>
            <button type="submit" disabled={busy} className="w-full rounded-xl bg-blue-700 py-2.5 text-sm font-bold text-white hover:bg-blue-800 disabled:opacity-50 flex items-center justify-center gap-2">
              {busy && <Loader2 size={14} className="animate-spin"/>} Enroll Member
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">{title}</h2>
          <button type="button" aria-label="Close welfare panel" onClick={onClose} className="grid h-7 w-7 place-items-center rounded-lg text-slate-400 hover:bg-slate-100"><X size={15}/></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", required }: { label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-700 mb-1">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} required={required} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-800 dark:border-slate-600 dark:text-white" />
    </div>
  );
}
