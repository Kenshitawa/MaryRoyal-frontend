"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, BookOpen, Check, RotateCcw, X, AlertCircle, Loader2, Package, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/ui/primitives";

type Textbook = {
  id: string;
  title: string;
  subject: string;
  grade: string;
  publisher: string | null;
  curriculumCode: string | null;
  totalCopies: number;
  availableCopies: number;
  createdAt: string;
  issues: TextbookIssue[];
};

type TextbookIssue = {
  id: string;
  textbookId: string;
  teacherId: string;
  copyNumber: string | null;
  issuedAt: string;
  dueDate: string | null;
  status: string;
  confirmedAt: string | null;
  returnedAt: string | null;
  remarks: string | null;
  teacher: { id: string; name: string; role: string };
};

const STATUS_STYLE: Record<string, string> = {
  ISSUED_PENDING_CONFIRMATION: "bg-amber-100 text-amber-800",
  CONFIRMED: "bg-emerald-100 text-emerald-800",
  RETURN_REQUESTED: "bg-orange-100 text-orange-800",
  RETURNED: "bg-slate-100 text-slate-600",
};
const STATUS_LABEL: Record<string, string> = {
  ISSUED_PENDING_CONFIRMATION: "Pending Confirmation",
  CONFIRMED: "Confirmed",
  RETURN_REQUESTED: "Return Requested",
  RETURNED: "Returned",
};

export default function LibraryClient({ role }: { role: string; userId?: string }) {
  const isAdmin = ["DEPUTY", "HEAD_TEACHER", "DIRECTOR"].includes(role);
  const isTeacher = role === "TEACHER";

  const [textbooks, setTextbooks] = useState<Textbook[]>([]);
  const [myIssues, setMyIssues] = useState<(TextbookIssue & { textbook: Textbook })[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showIssue, setShowIssue] = useState<string | null>(null); // textbookId
  const [allStaff, setAllStaff] = useState<{ id: string; name: string }[]>([]);
  const [createForm, setCreateForm] = useState({ title: "", subject: "", grade: "", publisher: "", curriculumCode: "", totalCopies: "1" });
  const [aiTopic, setAiTopic] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [issueForm, setIssueForm] = useState({ teacherId: "", copyNumber: "", dueDate: "", remarks: "" });

  const load = useCallback(async () => {
    const res = await fetch("/api/textbooks");
    if (!res.ok) return;
    const data = await res.json();
    setTextbooks(data.textbooks ?? []);
    setMyIssues(data.myIssues ?? []);
  }, []);

  const loadStaff = useCallback(async () => {
    const res = await fetch("/api/textbooks");
    if (!res.ok) return;
    const data = await res.json();
    setAllStaff(data.staffOptions ?? []);
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (isAdmin) void loadStaff(); }, [isAdmin, loadStaff]);

  function notify(text: string, ok = true) { setMsg({ text, ok }); setTimeout(() => setMsg(null), 4000); }

  async function apiPost(body: Record<string, unknown>) {
    setBusy(true);
    try {
      const res = await fetch("/api/textbooks", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) { notify(data.error ?? "Error", false); return false; }
      return true;
    } finally { setBusy(false); }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const ok = await apiPost({ _action: "create", ...createForm, totalCopies: Number(createForm.totalCopies) });
    if (ok) { notify("Textbook registered!"); setShowCreate(false); void load(); }
  }

  async function draftBook() {
    setAiBusy(true);
    try {
      const response = await fetch("/api/ai/draft", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind: "textbook", grade: createForm.grade, subject: createForm.subject, topic: aiTopic }) });
      const data = await response.json();
      if (!response.ok) { notify(data.error ?? "Draft unavailable", false); return; }
      setCreateForm((current) => ({ ...current, ...data.draft }));
      notify("Catalogue suggestion added. Verify all details before saving.");
    } catch { notify("Could not reach the local AI service.", false); }
    finally { setAiBusy(false); }
  }

  async function handleIssue(e: React.FormEvent, textbookId: string) {
    e.preventDefault();
    const ok = await apiPost({ _action: "issue", textbookId, ...issueForm, dueDate: issueForm.dueDate ? new Date(issueForm.dueDate).toISOString() : undefined });
    if (ok) { notify("Textbook issued — teacher will be notified to confirm receipt."); setShowIssue(null); void load(); }
  }

  async function handleAction(issueId: string, action: string, remarks?: string) {
    const ok = await apiPost({ _action: "action", issueId, action, remarks });
    if (ok) { notify(action === "confirm" ? "Receipt confirmed!" : "Done."); void load(); }
  }

  const pendingConfirm = myIssues.filter((i) => i.status === "ISSUED_PENDING_CONFIRMATION" || i.status === "RETURN_REQUESTED");

  return (
    <div className="mx-auto max-w-5xl space-y-3">
      <PageHeader
        title="Library & Textbooks"
        help={isAdmin ? "Manage textbook inventory and issuance across the school." : "View your issued textbooks and confirm receipt."}
        action={
          isAdmin ? (
            <button onClick={() => setShowCreate(true)} className="btn btn-primary btn-sm">
              <Plus size={15} aria-hidden="true" /> Add textbook
            </button>
          ) : undefined
        }
      />

      {msg && (
        <div className={`mb-4 rounded-xl p-3 text-sm font-semibold ${msg.ok ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800"}`}>
          {msg.text}
        </div>
      )}

      {/* Teacher — pending actions */}
      {isTeacher && pendingConfirm.length > 0 && (
        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <p className="mb-3 flex items-center gap-2 font-bold text-amber-800"><AlertCircle size={16}/> Action Required ({pendingConfirm.length})</p>
          {pendingConfirm.map((issue) => (
            <div key={issue.id} className="mb-3 flex items-center justify-between gap-3 rounded-xl bg-white p-3 shadow-sm">
              <div>
                <p className="font-semibold text-slate-900">{issue.textbook.title}</p>
                <p className="text-xs text-slate-500">{issue.textbook.subject} · {issue.textbook.grade}</p>
                <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_STYLE[issue.status]}`}>{STATUS_LABEL[issue.status]}</span>
              </div>
              {issue.status === "ISSUED_PENDING_CONFIRMATION" && (
                <button onClick={() => handleAction(issue.id, "confirm")} disabled={busy} className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700">
                  <Check size={12}/> Confirm Receipt
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* My issued books (teacher) */}
      {isTeacher && myIssues.length > 0 && (
        <div className="mb-8">
          <h2 className="mb-3 font-bold text-slate-800 dark:text-white">My Textbooks</h2>
          <div className="space-y-3">
            {myIssues.map((issue) => (
              <div key={issue.id} className="flex items-center justify-between rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white">{issue.textbook.title}</p>
                  <p className="text-xs text-slate-500">{issue.textbook.subject} · {issue.textbook.grade}</p>
                  {issue.dueDate && <p className="text-xs text-slate-400">Due: {new Date(issue.dueDate).toLocaleDateString("en-KE")}</p>}
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${STATUS_STYLE[issue.status] ?? "bg-slate-100"}`}>{STATUS_LABEL[issue.status] ?? issue.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Admin — textbook inventory */}
      {isAdmin && (
        <div className="space-y-4">
          <h2 className="font-bold text-slate-800 dark:text-white flex items-center gap-2"><Package size={16}/> Textbook Inventory ({textbooks.length})</h2>
          {textbooks.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center">
              <BookOpen size={32} className="mx-auto mb-3 text-slate-300"/>
              <p className="text-sm text-slate-500">No textbooks registered yet. Add one to get started.</p>
            </div>
          ) : textbooks.map((book) => (
            <div key={book.id} className="rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100">
                    <BookOpen size={20} className="text-blue-700"/>
                  </div>
                  <div>
                    <p className="font-bold text-slate-900 dark:text-white">{book.title}</p>
                    <p className="text-xs text-slate-500">{book.subject} · {book.grade}{book.publisher ? ` · ${book.publisher}` : ""}</p>
                    <p className="text-xs text-slate-400">{book.availableCopies}/{book.totalCopies} copies available</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${book.availableCopies > 0 ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                    {book.availableCopies > 0 ? `${book.availableCopies} available` : "None available"}
                  </span>
                  {book.availableCopies > 0 && (
                    <button onClick={() => { setShowIssue(book.id); setIssueForm({ teacherId: "", copyNumber: "", dueDate: "", remarks: "" }); }} className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100">
                      Issue
                    </button>
                  )}
                </div>
              </div>
              {book.issues.filter((i) => i.status !== "RETURNED").length > 0 && (
                <div className="border-t border-slate-100 px-5 pb-4 pt-3 dark:border-slate-800">
                  <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">Current Issues</p>
                  <div className="space-y-2">
                    {book.issues.filter((i) => i.status !== "RETURNED").map((issue) => (
                      <div key={issue.id} className="flex items-center justify-between text-sm">
                        <span className="text-slate-700 dark:text-slate-300">{issue.teacher.name}</span>
                        <div className="flex items-center gap-2">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_STYLE[issue.status]}`}>{STATUS_LABEL[issue.status]}</span>
                          {issue.status === "CONFIRMED" && (
                            <button onClick={() => handleAction(issue.id, "return-request")} disabled={busy} className="rounded-md bg-orange-100 px-2 py-0.5 text-[10px] font-bold text-orange-700 hover:bg-orange-200">
                              Request Return
                            </button>
                          )}
                          {issue.status === "RETURN_REQUESTED" && (
                            <button onClick={() => handleAction(issue.id, "confirm-return")} disabled={busy} className="flex items-center gap-1 rounded-md bg-slate-700 px-2 py-0.5 text-[10px] font-bold text-white hover:bg-slate-900">
                              <RotateCcw size={9}/> Confirm Return
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <Modal title="Register Textbook" onClose={() => setShowCreate(false)}>
          <form onSubmit={handleCreate} className="space-y-4">
            <Field label="Topic or curriculum context for optional AI suggestion" value={aiTopic} onChange={setAiTopic} />
            <button type="button" onClick={() => void draftBook()} disabled={aiBusy || !createForm.grade || !createForm.subject || aiTopic.trim().length < 2} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 text-xs font-bold text-blue-800 disabled:opacity-50 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-300"><Sparkles size={14}/>{aiBusy ? "Drafting locally…" : "Suggest record with local AI"}</button>
            <Field label="Title" value={createForm.title} onChange={(v) => setCreateForm((f) => ({ ...f, title: v }))} required />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Subject" value={createForm.subject} onChange={(v) => setCreateForm((f) => ({ ...f, subject: v }))} required />
              <Field label="Grade" value={createForm.grade} onChange={(v) => setCreateForm((f) => ({ ...f, grade: v }))} required />
            </div>
            <Field label="Publisher (optional)" value={createForm.publisher} onChange={(v) => setCreateForm((f) => ({ ...f, publisher: v }))} />
            <Field label="Curriculum Code (optional)" value={createForm.curriculumCode} onChange={(v) => setCreateForm((f) => ({ ...f, curriculumCode: v }))} />
            <Field label="Total Copies" type="number" value={createForm.totalCopies} onChange={(v) => setCreateForm((f) => ({ ...f, totalCopies: v }))} required />
            <button type="submit" disabled={busy} className="w-full rounded-xl bg-blue-700 py-2.5 text-sm font-bold text-white hover:bg-blue-800 disabled:opacity-50 flex items-center justify-center gap-2">
              {busy && <Loader2 size={14} className="animate-spin"/>} Register Textbook
            </button>
          </form>
        </Modal>
      )}

      {/* Issue Modal */}
      {showIssue && (
        <Modal title="Issue Textbook to Teacher" onClose={() => setShowIssue(null)}>
          <form onSubmit={(e) => handleIssue(e, showIssue)} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Teacher</label>
              <select value={issueForm.teacherId} onChange={(e) => setIssueForm((f) => ({ ...f, teacherId: e.target.value }))} required className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Select teacher…</option>
                {allStaff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <Field label="Copy Number (optional)" value={issueForm.copyNumber} onChange={(v) => setIssueForm((f) => ({ ...f, copyNumber: v }))} />
            <Field label="Due Date (optional)" type="date" value={issueForm.dueDate} onChange={(v) => setIssueForm((f) => ({ ...f, dueDate: v }))} />
            <Field label="Remarks (optional)" value={issueForm.remarks} onChange={(v) => setIssueForm((f) => ({ ...f, remarks: v }))} />
            <button type="submit" disabled={busy} className="w-full rounded-xl bg-blue-700 py-2.5 text-sm font-bold text-white hover:bg-blue-800 disabled:opacity-50 flex items-center justify-center gap-2">
              {busy && <Loader2 size={14} className="animate-spin"/>} Issue Textbook
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
          <button type="button" aria-label="Close textbook panel" onClick={onClose} className="grid h-7 w-7 place-items-center rounded-lg text-slate-400 hover:bg-slate-100"><X size={15}/></button>
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
