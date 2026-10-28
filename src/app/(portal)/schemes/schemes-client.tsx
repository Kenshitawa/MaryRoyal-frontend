"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { LayoutList, Plus, CheckCircle2, XCircle, Filter, X, Loader2, ChevronDown, ChevronUp, Sparkles } from "lucide-react";

type Teaching = { grade: string; subject: string };
type Scheme = {
  id: string;
  grade: string;
  subject: string;
  term: string;
  year: number;
  week: number;
  lessonNo: number;
  strand: string;
  subStrand: string;
  learningOutcomes: string;
  keyInquiryQuestions: string | null;
  learningExperiences: string;
  learningResources: string;
  assessmentMethods: string;
  reflection: string | null;
  status: string;
  deputyFeedback: string | null;
  headteacherFeedback: string | null;
  createdAt: string;
  teacher: { id: string; name: string; role: string };
};

const STATUS_STYLE: Record<string, string> = {
  SUBMITTED: "bg-blue-100 text-blue-800",
  CONFIRMED_BY_DEPUTY: "bg-emerald-100 text-emerald-800",
  VERIFIED_BY_HEADTEACHER: "bg-purple-100 text-purple-800",
  REJECTED: "bg-rose-100 text-rose-800",
  DRAFT: "bg-slate-100 text-slate-600",
};
const STATUS_LABEL: Record<string, string> = {
  SUBMITTED: "Submitted",
  CONFIRMED_BY_DEPUTY: "Confirmed by Deputy",
  VERIFIED_BY_HEADTEACHER: "Verified ✓",
  REJECTED: "Needs Revision",
  DRAFT: "Draft",
};

const TERMS = ["2026 Term 1", "2026 Term 2", "2026 Term 3", "2027 Term 1", "2027 Term 2", "2027 Term 3"];

export default function SchemesClient({ role, teaching }: { role: string; userId?: string; teaching: Teaching[] }) {
  const isAdmin = ["DEPUTY", "HEAD_TEACHER", "DIRECTOR"].includes(role);
  const isTeacher = role === "TEACHER";

  const [schemes, setSchemes] = useState<Scheme[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [filterTerm, setFilterTerm] = useState("ALL");
  const [aiBusy, setAiBusy] = useState(false);

  const [form, setForm] = useState({
    grade: teaching[0]?.grade ?? "",
    subject: teaching[0]?.subject ?? "",
    term: TERMS[0],
    year: new Date().getFullYear(),
    week: 1,
    lessonNo: 1,
    strand: "",
    subStrand: "",
    learningOutcomes: "",
    keyInquiryQuestions: "",
    learningExperiences: "",
    learningResources: "",
    assessmentMethods: "",
    reflection: "",
  });

  const grades = useMemo(() => [...new Set(teaching.map((t) => t.grade))], [teaching]);
  const subjects = useMemo(() => teaching.filter((t) => t.grade === form.grade).map((t) => t.subject), [teaching, form.grade]);

  const load = useCallback(async () => {
    const res = await fetch("/api/schemes");
    if (res.ok) { const data = await res.json(); setSchemes(data.schemes ?? []); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  function notify(text: string, ok = true) { setMsg({ text, ok }); setTimeout(() => setMsg(null), 4000); }

  async function draftWithAI() {
    setAiBusy(true);
    try {
      const response = await fetch("/api/ai/draft", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind: "scheme", grade: form.grade, subject: form.subject, topic: form.strand || form.subStrand || form.learningOutcomes }) });
      const result = await response.json();
      if (!response.ok) { notify(result.error ?? "Draft unavailable", false); return; }
      setForm((current) => ({ ...current, ...result.draft }));
      notify("AI draft added. Review and edit it before submitting.");
    } catch { notify("Could not reach the local AI service.", false); }
    finally { setAiBusy(false); }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch("/api/schemes", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...form, week: Number(form.week), lessonNo: Number(form.lessonNo), year: Number(form.year) }) });
      const data = await res.json();
      if (!res.ok) { notify(data.error ?? "Error", false); return; }
      notify("Scheme submitted — Deputy and Head Teacher notified!");
      setShowCreate(false);
      void load();
    } finally { setBusy(false); }
  }

  async function handleReview(schemeId: string, action: string, feedback?: string) {
    setBusy(true);
    try {
      const res = await fetch("/api/schemes", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ schemeId, action, feedback }) });
      const data = await res.json();
      if (!res.ok) { notify(data.error ?? "Error", false); return; }
      notify("Done!");
      void load();
    } finally { setBusy(false); }
  }

  const filtered = schemes.filter((s) => {
    if (filterStatus !== "ALL" && s.status !== filterStatus) return false;
    if (filterTerm !== "ALL" && s.term !== filterTerm) return false;
    return true;
  });

  const pendingReview = schemes.filter((s) => {
    if (role === "DEPUTY") return s.status === "SUBMITTED";
    if (role === "HEAD_TEACHER") return s.status === "CONFIRMED_BY_DEPUTY" || s.status === "SUBMITTED";
    return false;
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-10">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-white">
            <LayoutList size={24} className="text-purple-700" /> Schemes of Work
          </h1>
          <p className="mt-1 text-sm text-slate-500">{isTeacher ? "Submit and track your weekly lesson schemes" : "Review and verify teacher schemes of work"}</p>
        </div>
        {isTeacher && (
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 rounded-xl bg-purple-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-purple-800 shadow-sm">
            <Plus size={15} /> Submit Scheme
          </button>
        )}
      </div>

      {msg && (
        <div className={`mb-4 rounded-xl p-3 text-sm font-semibold ${msg.ok ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800"}`}>{msg.text}</div>
      )}

      {/* Pending reviews for admin */}
      {isAdmin && pendingReview.length > 0 && (
        <div className="mb-6 rounded-2xl border border-blue-200 bg-blue-50 p-4 dark:bg-blue-950/20">
          <p className="mb-2 text-sm font-bold text-blue-800">📋 {pendingReview.length} scheme(s) awaiting your review</p>
        </div>
      )}

      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-3">
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2">
          <Filter size={13} className="text-slate-400" />
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="text-sm text-slate-700 bg-transparent focus:outline-none">
            <option value="ALL">All statuses</option>
            {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2">
          <select value={filterTerm} onChange={(e) => setFilterTerm(e.target.value)} className="text-sm text-slate-700 bg-transparent focus:outline-none">
            <option value="ALL">All terms</option>
            {TERMS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      {/* Schemes list */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center">
          <LayoutList size={32} className="mx-auto mb-3 text-slate-300" />
          <p className="text-sm text-slate-500">{isTeacher ? "No schemes submitted yet. Click 'Submit Scheme' to start." : "No schemes match your filters."}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((scheme) => (
            <div key={scheme.id} className="rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              <button onClick={() => setExpanded(expanded === scheme.id ? null : scheme.id)} className="flex w-full items-center justify-between px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-800 text-left">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="shrink-0 flex h-10 w-10 items-center justify-center rounded-xl bg-purple-100 text-sm font-bold text-purple-800">
                    W{scheme.week}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900 dark:text-white truncate">{scheme.grade} — {scheme.subject} · {scheme.strand}</p>
                    <p className="text-xs text-slate-500">{scheme.term} · Week {scheme.week}, Lesson {scheme.lessonNo} {isAdmin ? `· ${scheme.teacher.name}` : ""}</p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2 ml-2">
                  <span className={`rounded-full px-3 py-1 text-[10px] font-bold hidden sm:inline ${STATUS_STYLE[scheme.status]}`}>{STATUS_LABEL[scheme.status]}</span>
                  {expanded === scheme.id ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
                </div>
              </button>

              {expanded === scheme.id && (
                <div className="border-t border-slate-100 px-5 pb-5 pt-4 dark:border-slate-800 space-y-3">
                  <div className="grid gap-3 text-sm sm:grid-cols-2">
                    <InfoRow label="Strand" value={scheme.strand} />
                    <InfoRow label="Sub-Strand" value={scheme.subStrand} />
                    <InfoRow label="Learning Outcomes" value={scheme.learningOutcomes} />
                    {scheme.keyInquiryQuestions && <InfoRow label="Key Inquiry Questions" value={scheme.keyInquiryQuestions} />}
                    <InfoRow label="Learning Experiences" value={scheme.learningExperiences} />
                    <InfoRow label="Resources" value={scheme.learningResources} />
                    <InfoRow label="Assessment Methods" value={scheme.assessmentMethods} />
                    {scheme.reflection && <InfoRow label="Reflection" value={scheme.reflection} />}
                  </div>

                  {/* Feedback */}
                  {scheme.deputyFeedback && <p className="rounded-xl bg-blue-50 p-3 text-xs text-blue-800"><strong>Deputy feedback:</strong> {scheme.deputyFeedback}</p>}
                  {scheme.headteacherFeedback && <p className="rounded-xl bg-purple-50 p-3 text-xs text-purple-800"><strong>Head Teacher feedback:</strong> {scheme.headteacherFeedback}</p>}

                  {/* Admin review actions */}
                  {isAdmin && (
                    <div className="flex flex-wrap gap-2 pt-2">
                      {(scheme.status === "SUBMITTED") && (role === "DEPUTY" || role === "HEAD_TEACHER" || role === "DIRECTOR") && (
                        <>
                          <button disabled={busy} onClick={() => handleReview(scheme.id, "confirm-deputy")} className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700">
                            <CheckCircle2 size={12}/> Confirm (Deputy)
                          </button>
                          <button disabled={busy} onClick={() => { const fb = window.prompt("Feedback for teacher:"); void handleReview(scheme.id, "reject", fb ?? undefined); }} className="flex items-center gap-1 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-rose-700">
                            <XCircle size={12}/> Request Revision
                          </button>
                        </>
                      )}
                      {scheme.status === "CONFIRMED_BY_DEPUTY" && (role === "HEAD_TEACHER" || role === "DIRECTOR") && (
                        <button disabled={busy} onClick={() => handleReview(scheme.id, "verify-head")} className="flex items-center gap-1 rounded-lg bg-purple-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-purple-800">
                          <CheckCircle2 size={12}/> Verify (Head Teacher)
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-8">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Submit Scheme of Work</h2>
              <button type="button" aria-label="Close scheme editor" onClick={() => setShowCreate(false)} className="grid h-7 w-7 place-items-center rounded-lg text-slate-400 hover:bg-slate-100"><X size={15}/></button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <button type="button" onClick={() => void draftWithAI()} disabled={aiBusy || !form.grade || !form.subject || !(form.strand || form.subStrand || form.learningOutcomes)} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 text-sm font-semibold text-blue-800 disabled:opacity-50 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-300"><Sparkles size={15}/>{aiBusy ? "Drafting locally…" : "Draft with local AI"}</button>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Grade</label>
                  <select value={form.grade} onChange={(e) => setForm((f) => ({ ...f, grade: e.target.value, subject: "" }))} required className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500">
                    {grades.map((g) => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Subject</label>
                  <select value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))} required className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500">
                    <option value="">Select…</option>
                    {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Term</label>
                  <select value={form.term} onChange={(e) => setForm((f) => ({ ...f, term: e.target.value }))} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm">
                    {TERMS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <FormField label="Week" type="number" value={String(form.week)} onChange={(v) => setForm((f) => ({ ...f, week: Number(v) }))} required />
                  <FormField label="Lesson" type="number" value={String(form.lessonNo)} onChange={(v) => setForm((f) => ({ ...f, lessonNo: Number(v) }))} required />
                </div>
              </div>
              <FormField label="Strand" value={form.strand} onChange={(v) => setForm((f) => ({ ...f, strand: v }))} required />
              <FormField label="Sub-Strand" value={form.subStrand} onChange={(v) => setForm((f) => ({ ...f, subStrand: v }))} required />
              <TextareaField label="Specific Learning Outcomes" value={form.learningOutcomes} onChange={(v) => setForm((f) => ({ ...f, learningOutcomes: v }))} required />
              <TextareaField label="Key Inquiry Questions (optional)" value={form.keyInquiryQuestions} onChange={(v) => setForm((f) => ({ ...f, keyInquiryQuestions: v }))} />
              <TextareaField label="Learning Experiences" value={form.learningExperiences} onChange={(v) => setForm((f) => ({ ...f, learningExperiences: v }))} required />
              <FormField label="Learning Resources" value={form.learningResources} onChange={(v) => setForm((f) => ({ ...f, learningResources: v }))} required />
              <FormField label="Assessment Methods" value={form.assessmentMethods} onChange={(v) => setForm((f) => ({ ...f, assessmentMethods: v }))} required />
              <TextareaField label="Reflection (optional)" value={form.reflection} onChange={(v) => setForm((f) => ({ ...f, reflection: v }))} />
              <button type="submit" disabled={busy} className="w-full rounded-xl bg-purple-700 py-2.5 text-sm font-bold text-white hover:bg-purple-800 disabled:opacity-50 flex items-center justify-center gap-2">
                {busy && <Loader2 size={14} className="animate-spin"/>} Submit Scheme of Work
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-0.5 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{value}</p>
    </div>
  );
}

function FormField({ label, value, onChange, type = "text", required }: { label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-700 mb-1">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} required={required} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-slate-800 dark:border-slate-600 dark:text-white" />
    </div>
  );
}

function TextareaField({ label, value, onChange, required }: { label: string; value: string; onChange: (v: string) => void; required?: boolean }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-700 mb-1">{label}</label>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} required={required} rows={2} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-slate-800 dark:border-slate-600 dark:text-white" />
    </div>
  );
}
