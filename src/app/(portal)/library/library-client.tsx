"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, BookOpen, Check, RotateCcw, X, AlertCircle, Loader2, Package, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/ui/primitives";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { Select, SelectItem } from "@/components/base/select/select";
import { RiAddLine } from "@remixicon/react";
import { CURRICULUM_GRADES, CURRICULUM_SUBJECTS } from "@/lib/curriculum";

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
type TeachingAssignment = { grade: string; subject: string };
type TextbookRequest = {
  id: string;
  title: string;
  subject: string;
  grade: string;
  quantity: number;
  notes: string | null;
  status: string;
  responseNotes: string | null;
  requestedBy: { id: string; name: string };
  reviewedBy: { name: string } | null;
  createdAt: string;
};
type LearningResource = {
  id: string;
  title: string;
  description: string;
  grade: string;
  subject: string;
  url: string;
  kind: string;
  createdAt: string;
  teacher: { id?: string; name: string };
};
type EbookForm = { title: string; description: string; grade: string; subject: string; url: string };

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
  const isAdmin = ["DEPUTY", "SENIOR_TEACHER", "HEAD_TEACHER", "DIRECTOR"].includes(role);
  const isTeacher = role === "TEACHER";

  const [textbooks, setTextbooks] = useState<Textbook[]>([]);
  const [myIssues, setMyIssues] = useState<(TextbookIssue & { textbook: Textbook })[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showIssue, setShowIssue] = useState<string | null>(null); // textbookId
  const [allStaff, setAllStaff] = useState<{ id: string; name: string }[]>([]);
  const [requests, setRequests] = useState<TextbookRequest[]>([]);
  const [teachingAssignments, setTeachingAssignments] = useState<TeachingAssignment[]>([]);
  const [resources, setResources] = useState<LearningResource[]>([]);
  const [selectedAssignment, setSelectedAssignment] = useState("");
  const [requestForm, setRequestForm] = useState({ title: "", quantity: "1", notes: "" });
  const [decisionNotes, setDecisionNotes] = useState<Record<string, string>>({});
  const [ebookForm, setEbookForm] = useState<EbookForm>({ title: "", description: "", grade: CURRICULUM_GRADES[0], subject: CURRICULUM_SUBJECTS[0], url: "" });
  const [createForm, setCreateForm] = useState({ title: "", subject: "", grade: "", publisher: "", curriculumCode: "", totalCopies: "1" });
  const [aiTopic, setAiTopic] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [issueForm, setIssueForm] = useState({ teacherId: "", copyNumber: "", dueDate: "", remarks: "" });

  const notify = useCallback((text: string, ok = true) => {
    setMsg({ text, ok });
    setTimeout(() => setMsg(null), 4000);
  }, []);
  const notifyResponseError = useCallback((text: string) => notify(text, false), [notify]);

  const load = useCallback(async () => {
    try {
      const [textbookResponse, resourceResponse] = await Promise.all([
        fetch("/api/textbooks"),
        fetch("/api/learning/resources"),
      ]);
      if (!textbookResponse.ok) {
        notifyResponseError("Could not load the textbook library.");
        return;
      }
      if (!resourceResponse.ok) {
        notifyResponseError("Could not load learning resources.");
        return;
      }
      const [textbookData, resourceData] = await Promise.all([textbookResponse.json(), resourceResponse.json()]);
      setTextbooks(textbookData.textbooks ?? []);
      setMyIssues(textbookData.myIssues ?? []);
      setRequests(textbookData.requests ?? []);
      setTeachingAssignments(textbookData.teachingAssignments ?? []);
      setResources((resourceData.resources ?? []).filter((resource: LearningResource) => resource.kind === "EBOOK"));
      if (textbookData.teachingAssignments?.length) {
        const first = textbookData.teachingAssignments[0];
        setSelectedAssignment((current) => current || `${first.grade}::${first.subject}`);
      }
      if (!isTeacher) setAllStaff(textbookData.staffOptions ?? []);
    } catch {
      notifyResponseError("Could not reach the library services.");
    }
  }, [isTeacher, notifyResponseError]);

  useEffect(() => { void load(); }, [load]);

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

  async function handleRequest(e: React.FormEvent) {
    e.preventDefault();
    const assignment = teachingAssignments.find((item) => `${item.grade}::${item.subject}` === selectedAssignment);
    if (!assignment) {
      notify("Select one of your assigned classes and subjects.", false);
      return;
    }
    const ok = await apiPost({
      _action: "request",
      ...requestForm,
      quantity: Number(requestForm.quantity),
      grade: assignment.grade,
      subject: assignment.subject,
    });
    if (ok) {
      setRequestForm({ title: "", quantity: "1", notes: "" });
      notify("Textbook request sent to school leadership.");
      void load();
    }
  }

  async function handleRequestDecision(requestId: string, decision: "APPROVED" | "REJECTED") {
    const ok = await apiPost({ _action: "request-decision", requestId, decision, responseNotes: decisionNotes[requestId] || undefined });
    if (ok) {
      setDecisionNotes((current) => ({ ...current, [requestId]: "" }));
      notify(`Textbook request ${decision.toLowerCase()}.`);
      void load();
    }
  }

  async function handleEbookPublish(e: React.FormEvent) {
    e.preventDefault();
    const ok = await apiPost({ ...ebookForm, kind: "EBOOK" });
    if (ok) {
      setEbookForm({ title: "", description: "", grade: CURRICULUM_GRADES[0], subject: CURRICULUM_SUBJECTS[0], url: "" });
      notify("eBook published for its selected class and learning area.");
      void load();
    }
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

      <section className="grid gap-4 lg:grid-cols-2">
        {isTeacher && (
          <form onSubmit={handleRequest} className="rounded-3xl border border-border-button-default bg-background-primary-default p-5">
            <h2 className="text-title-3-semibold text-text-primary">Request a textbook</h2>
            <p className="mt-1 text-body-2-regular text-text-secondary">Requests go to the Deputy, Senior Teacher and school leadership for review.</p>
            {teachingAssignments.length === 0 ? (
              <p className="mt-4 rounded-xl bg-background-secondary-default p-3 text-body-2-regular text-text-secondary">No teaching assignments are linked to your account yet.</p>
            ) : (
              <div className="mt-4 space-y-3">
                <Select
                  label="Assigned class and learning area"
                  selectedKey={selectedAssignment}
                  onSelectionChange={(key) => setSelectedAssignment(String(key))}
                >
                  {teachingAssignments.map((assignment) => {
                    const key = `${assignment.grade}::${assignment.subject}`;
                    return <SelectItem key={key} id={key}>{assignment.grade} · {assignment.subject}</SelectItem>;
                  })}
                </Select>
                <Input label="Textbook title or topic" value={requestForm.title} onChange={(title) => setRequestForm((current) => ({ ...current, title }))} isRequired maxLength={120} />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input label="Number of copies (1–100)" type="number" value={requestForm.quantity} onChange={(quantity) => setRequestForm((current) => ({ ...current, quantity }))} isRequired />
                  <Input label="Reason or learner need (optional)" value={requestForm.notes} onChange={(notes) => setRequestForm((current) => ({ ...current, notes }))} maxLength={500} />
                </div>
                <Button type="submit" disabled={busy || teachingAssignments.length === 0} leadingIcon={RiAddLine}>Send request</Button>
              </div>
            )}
          </form>
        )}

        {isAdmin && (
          <form onSubmit={handleEbookPublish} className="rounded-3xl border border-border-button-default bg-background-primary-default p-5">
            <h2 className="text-title-3-semibold text-text-primary">Publish an eBook</h2>
            <p className="mt-1 text-body-2-regular text-text-secondary">Add a secure link for a class and learning area. Prefer official KICD and Kenya Education Cloud sources.</p>
            <div className="mt-4 space-y-3">
              <Input label="eBook title" value={ebookForm.title} onChange={(title) => setEbookForm((current) => ({ ...current, title }))} isRequired maxLength={120} />
              <Input label="Short description" value={ebookForm.description} onChange={(description) => setEbookForm((current) => ({ ...current, description }))} isRequired maxLength={500} />
              <div className="grid gap-3 sm:grid-cols-2">
                <Select
                  label="Grade"
                  selectedKey={ebookForm.grade}
                  onSelectionChange={(key) => key && setEbookForm((current) => ({ ...current, grade: String(key) }))}
                >
                  {CURRICULUM_GRADES.map((grade) => <SelectItem key={grade} id={grade}>{grade}</SelectItem>)}
                </Select>
                <Select
                  label="Learning area"
                  selectedKey={ebookForm.subject}
                  onSelectionChange={(key) => key && setEbookForm((current) => ({ ...current, subject: String(key) }))}
                >
                  {CURRICULUM_SUBJECTS.map((subject) => <SelectItem key={subject} id={subject}>{subject}</SelectItem>)}
                </Select>
              </div>
              <Input label="HTTPS eBook link" type="url" inputDir="ltr" value={ebookForm.url} onChange={(url) => setEbookForm((current) => ({ ...current, url }))} isRequired maxLength={1000} />
              <Button type="submit" disabled={busy} leadingIcon={RiAddLine}>Publish eBook</Button>
            </div>
          </form>
        )}
      </section>

      <section className="rounded-3xl border border-border-button-default bg-background-primary-default p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-title-3-semibold text-text-primary">{isTeacher ? "My textbook requests" : "Textbook requests"}</h2>
            <p className="mt-1 text-body-2-regular text-text-secondary">{requests.length} request{requests.length === 1 ? "" : "s"} in your view</p>
          </div>
        </div>
        {requests.length === 0 ? (
          <p className="mt-4 rounded-xl bg-background-secondary-default p-4 text-body-2-regular text-text-secondary">No textbook requests yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-separator-border">
            {requests.map((item) => (
              <li key={item.id} className="grid gap-3 py-4 sm:grid-cols-[1fr_auto] sm:items-start">
                <div>
                  <p className="text-body-medium text-text-primary">{item.title} · {item.quantity} {item.quantity === 1 ? "copy" : "copies"}</p>
                  <p className="text-body-2-regular text-text-secondary">{item.grade} · {item.subject}{!isTeacher ? ` · Requested by ${item.requestedBy.name}` : ""}</p>
                  {item.notes && <p className="mt-1 text-body-2-regular text-text-secondary">{item.notes}</p>}
                  {item.responseNotes && <p className="mt-2 rounded-xl bg-background-secondary-default p-3 text-body-2-regular text-text-secondary">Leadership: {item.responseNotes}</p>}
                </div>
                <div className="flex flex-col items-start gap-2 sm:items-end">
                  <span className="rounded-full bg-background-secondary-default px-3 py-1 text-caption-1-semibold text-text-secondary">{item.status}</span>
                  {isAdmin && item.status === "PENDING" && (
                    <div className="flex flex-wrap gap-2">
                      <Input
                        aria-label={`Reply to ${item.requestedBy.name}`}
                        placeholder="Optional reply"
                        value={decisionNotes[item.id] ?? ""}
                        onChange={(value) => setDecisionNotes((current) => ({ ...current, [item.id]: value }))}
                        maxLength={500}
                      />
                      <Button type="button" size="small" variant="primary" disabled={busy} onClick={() => void handleRequestDecision(item.id, "APPROVED")}>Approve</Button>
                      <Button type="button" size="small" variant="secondary" disabled={busy} onClick={() => void handleRequestDecision(item.id, "REJECTED")}>Decline</Button>
                    </div>
                  )}
                  {item.reviewedBy && <span className="text-caption-1-regular text-text-tertiary">Reviewed by {item.reviewedBy.name}</span>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-3xl border border-border-button-default bg-background-primary-default p-5">
        <h2 className="text-title-3-semibold text-text-primary">eBooks for learning</h2>
        {resources.length === 0 ? (
          <p className="mt-3 text-body-2-regular text-text-secondary">No eBooks have been published for the classes and subjects available to you.</p>
        ) : (
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {resources.map((resource) => (
              <li key={resource.id} className="rounded-2xl border border-separator-border p-4">
                <p className="text-body-medium text-text-primary">{resource.title}</p>
                <p className="mt-1 text-body-2-regular text-text-secondary">{resource.grade} · {resource.subject}</p>
                <p className="mt-2 text-body-2-regular text-text-secondary">{resource.description}</p>
                <a className="mt-3 inline-flex text-body-2-medium text-accent-700 underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring" href={resource.url} target="_blank" rel="noreferrer">Open eBook</a>
              </li>
            ))}
          </ul>
        )}
      </section>

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
