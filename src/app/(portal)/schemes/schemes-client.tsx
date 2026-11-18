"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { LayoutList, Plus, CheckCircle2, XCircle, Filter, ChevronDown, ChevronUp, Sparkles, ChevronRight } from "lucide-react";
import { Spinner } from "@/components/base/spinner/spinner";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { Select, SelectItem } from "@/components/base/select/select";
import { Textarea } from "@/components/base/textarea/textarea";
import { Modal, ModalBody, ModalFooter, ModalHeader } from "@/components/base/modal/modal";
import { PageHeader } from "@/components/ui/primitives";
import { gradeOptions, subjectOptions, type CurriculumCatalog } from "@/lib/curriculum";

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

export default function SchemesClient({
  role,
  teaching,
  catalog,
}: {
  role: string;
  userId?: string;
  teaching: Teaching[];
  catalog?: CurriculumCatalog;
}) {
  const isAdmin = ["DEPUTY", "SENIOR_TEACHER", "HEAD_TEACHER", "DIRECTOR"].includes(role);
  const isTeacher = role === "TEACHER";

  const [schemes, setSchemes] = useState<Scheme[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [filterTerm, setFilterTerm] = useState("ALL");
  const [aiBusy, setAiBusy] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);

  const grades = useMemo(() => gradeOptions(teaching, catalog), [teaching, catalog]);

  const [form, setForm] = useState(() => ({
    grade: grades[0] ?? "",
    subject: subjectOptions(grades[0] ?? "", teaching, catalog)[0] ?? "",
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
  }));

  const subjects = useMemo(() => subjectOptions(form.grade, teaching, catalog), [teaching, form.grade, catalog]);
  const formSubject = subjects.includes(form.subject) ? form.subject : subjects[0] ?? "";

  const load = useCallback(async () => {
    const res = await fetch("/api/schemes");
    if (res.ok) { const data = await res.json(); setSchemes(data.schemes ?? []); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  function notify(text: string, ok = true) { setMsg({ text, ok }); setTimeout(() => setMsg(null), 4000); }

  async function draftWithAI() {
    setAiBusy(true);
    try {
      const response = await fetch("/api/ai/draft", { method: "POST", signal: AbortSignal.timeout(45_000), headers: { "content-type": "application/json" }, body: JSON.stringify({ kind: "scheme", grade: form.grade, subject: formSubject, topic: form.strand || form.subStrand || form.learningOutcomes }) });
      const result = await response.json();
      if (!response.ok) { notify(result.error ?? "Draft unavailable", false); return; }
      setForm((current) => ({ ...current, ...result.draft }));
      setPlanOpen(true);
      notify("AI draft added. Review and edit it before submitting.");
    } catch (error) { notify(error instanceof DOMException && error.name === "TimeoutError" ? "The local draft took too long. Your scheme is still here; try again." : "Could not reach the local AI service. Your scheme is still here; try again.", false); }
    finally { setAiBusy(false); }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.grade || !formSubject || !form.strand.trim() || !form.subStrand.trim() || !form.learningOutcomes.trim() || !form.learningExperiences.trim() || !form.learningResources.trim() || !form.assessmentMethods.trim()) {
      setPlanOpen(true);
      notify("Complete the learning outcomes, activities, resources and assessment before submitting.", false);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/schemes", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...form, subject: formSubject, week: Number(form.week), lessonNo: Number(form.lessonNo), year: Number(form.year) }) });
      const data = await res.json();
      if (!res.ok) { notify(data.error ?? "Error", false); return; }
      notify("Scheme submitted — Deputy and Head Teacher notified!");
      setShowCreate(false);
      void load();
    } catch { notify("The scheme could not be sent. Your entries are still here; try again.", false); }
    finally { setBusy(false); }
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
    if (role === "DEPUTY" || role === "SENIOR_TEACHER") return s.status === "SUBMITTED";
    if (role === "HEAD_TEACHER") return s.status === "CONFIRMED_BY_DEPUTY" || s.status === "SUBMITTED";
    return false;
  });

  return (
    <div className="mx-auto max-w-5xl space-y-3">
      <PageHeader
        title="Schemes of Work"
        help={isTeacher ? "Submit and track your weekly lesson schemes." : "Review and verify teacher schemes of work."}
        action={
          isTeacher ? (
            <button onClick={() => setShowCreate(true)} className="btn btn-primary btn-sm">
              <Plus size={15} aria-hidden="true" /> Submit scheme
            </button>
          ) : undefined
        }
      />

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
                      {(scheme.status === "SUBMITTED") && (role === "DEPUTY" || role === "SENIOR_TEACHER" || role === "HEAD_TEACHER" || role === "DIRECTOR") && (
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
      <Modal isOpen={showCreate} onOpenChange={setShowCreate} size="lg" overlayClassName="p-2 pt-[calc(env(safe-area-inset-top)+0.5rem)] pb-[calc(env(safe-area-inset-bottom)+0.5rem)] sm:p-6" className="h-[calc(var(--visual-viewport-height)-env(safe-area-inset-top)-env(safe-area-inset-bottom)-1rem)] max-h-full sm:h-[min(calc(var(--visual-viewport-height)-3rem),52rem)]">
        {({ close }) => <>
          <ModalHeader title="New scheme" description="Plan one lesson. Your draft stays here while you work." className="px-4 sm:px-6" closeLabel="Close scheme editor" />
          <ModalBody className="px-4 sm:px-6">
            <form id="scheme-create-form" onSubmit={handleCreate} className="space-y-3 pb-2">
              <Button type="button" onClick={() => void draftWithAI()} disabled={aiBusy || !form.grade || !formSubject} variant="secondary" size="small" leadingIcon={aiBusy ? undefined : Sparkles} aria-busy={aiBusy}>
                {aiBusy ? <><Spinner size="sm" aria-hidden className="text-current" /> Preparing your local draft…</> : "Draft with local AI"}
              </Button>
              <p role="status" aria-live="polite" className="min-h-5 text-caption-1-regular text-text-secondary">{aiBusy ? "Working on this screen. It will stop and show a retry message if it takes too long." : "Choose your class and lesson. Add the learning plan below."}</p>
              <div className="grid grid-cols-2 gap-2">
                <Select label="Grade" selectedKey={form.grade} onSelectionChange={(key) => { const nextGrade = String(key); const nextSubject = subjectOptions(nextGrade, teaching, catalog)[0] ?? ""; setForm((current) => ({ ...current, grade: nextGrade, subject: nextSubject })); }} triggerClassName="w-full" popoverClassName="w-(--trigger-width)">
                  {grades.map((grade) => <SelectItem key={grade} id={grade}>{grade}</SelectItem>)}
                </Select>
                <Select label="Learning area" selectedKey={formSubject} onSelectionChange={(key) => setForm((current) => ({ ...current, subject: String(key) }))} triggerClassName="w-full" popoverClassName="w-(--trigger-width)">
                  {subjects.map((subject) => <SelectItem key={subject} id={subject}>{subject}</SelectItem>)}
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Select label="Term" selectedKey={form.term} onSelectionChange={(key) => setForm((current) => ({ ...current, term: String(key) }))} triggerClassName="w-full" popoverClassName="w-(--trigger-width)">
                  {TERMS.map((term) => <SelectItem key={term} id={term}>{term}</SelectItem>)}
                </Select>
                <div className="grid grid-cols-2 gap-2">
                  <FormField label="Week" type="number" value={String(form.week)} onChange={(value) => setForm((current) => ({ ...current, week: Number(value) }))} required />
                  <FormField label="Lesson" type="number" value={String(form.lessonNo)} onChange={(value) => setForm((current) => ({ ...current, lessonNo: Number(value) }))} required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <FormField label="Strand" value={form.strand} onChange={(value) => setForm((current) => ({ ...current, strand: value }))} required />
                <FormField label="Sub-strand" value={form.subStrand} onChange={(value) => setForm((current) => ({ ...current, subStrand: value }))} required />
              </div>
              <Button type="button" variant="ghost" size="small" aria-expanded={planOpen} onClick={() => setPlanOpen((open) => !open)} leadingIcon={planOpen ? ChevronDown : ChevronRight}>
                Learning plan {planOpen ? "· close details" : "· outcomes, activities and assessment"}
              </Button>
              {planOpen ? <div className="space-y-3 rounded-2xl border border-border-button-default bg-background-secondary-default p-3">
                <Textarea label="Learning outcomes" value={form.learningOutcomes} onChange={(value) => setForm((current) => ({ ...current, learningOutcomes: value }))} rows={2} maxLength={1000} />
                <Textarea label="Learning experiences" value={form.learningExperiences} onChange={(value) => setForm((current) => ({ ...current, learningExperiences: value }))} rows={2} maxLength={1000} />
                <FormField label="Learning resources" value={form.learningResources} onChange={(value) => setForm((current) => ({ ...current, learningResources: value }))} />
                <FormField label="Assessment methods" value={form.assessmentMethods} onChange={(value) => setForm((current) => ({ ...current, assessmentMethods: value }))} />
                <Textarea label="Key inquiry questions · optional" value={form.keyInquiryQuestions} onChange={(value) => setForm((current) => ({ ...current, keyInquiryQuestions: value }))} rows={2} maxLength={500} />
                <Textarea label="Reflection · optional" value={form.reflection} onChange={(value) => setForm((current) => ({ ...current, reflection: value }))} rows={2} maxLength={500} />
              </div> : null}
            </form>
          </ModalBody>
          <ModalFooter className="px-4 pb-[env(safe-area-inset-bottom)] sm:px-6 sm:pb-0">
            <Button type="button" variant="secondary" onClick={close} disabled={busy}>Cancel</Button>
            <Button type="submit" form="scheme-create-form" disabled={busy} aria-busy={busy} leadingIcon={busy ? undefined : CheckCircle2} className="w-full sm:w-auto">
              {busy ? <><Spinner size="sm" aria-hidden className="text-current" /> Sending…</> : "Submit scheme"}
            </Button>
          </ModalFooter>
        </>}
      </Modal>
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
    <Input label={label} type={type} value={value} onChange={onChange} isRequired={required} />
  );
}
