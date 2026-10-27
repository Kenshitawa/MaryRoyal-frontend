"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { LearnerLink } from "@/components/learner-link";
import { MAX_UPLOAD_FILE_BYTES } from "@/lib/upload-limits";
import {
  AlertCircle,
  BookOpen,
  BookOpenCheck,
  CheckCircle2,
  Plus,
  Search,
  Send,
  Sparkles,
  Users,
  Camera,
  FileText,
  X,
  ExternalLink,
  Image as ImageIcon,
} from "lucide-react";

type Teaching = { grade: string; subject: string };
type Submission = {
  id: string;
  learnerId: string;
  response: string;
  score: number | null;
  feedback: string | null;
  status: string;
  submittedAt: string;
  attachmentUrl?: string | null;
  attachmentType?: string | null;
  learner?: { id: string; name: string; admissionNo: string };
};
type Assignment = {
  id: string;
  title: string;
  instructions: string;
  grade: string;
  subject: string;
  dueAt: string | null;
  maxScore: number;
  autoMark: boolean;
  createdAt: string;
  attachmentUrl?: string | null;
  attachmentType?: string | null;
  submissions: Submission[];
};

export default function AssignmentsClient({
  role,
  teaching,
}: {
  role: string;
  teaching: Teaching[];
}) {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [grade, setGrade] = useState(teaching[0]?.grade ?? "");
  const [subject, setSubject] = useState(teaching[0]?.subject ?? "");
  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [topic, setTopic] = useState("");
  const [answerKey, setAnswerKey] = useState("");
  const [maxScore, setMaxScore] = useState("100");
  const [dueAt, setDueAt] = useState("");
  const [autoMark, setAutoMark] = useState(false);
  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null);
  const [attachmentType, setAttachmentType] = useState<string | null>(null);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [learnerAttachments, setLearnerAttachments] = useState<Record<string, { url: string; type: string }>>({});
  const [learnerUploading, setLearnerUploading] = useState<Record<string, boolean>>({});
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState("");

  const isTeacher = role === "TEACHER";
  const isLearner = role === "LEARNER";

  const subjects = useMemo(
    () => teaching.filter((item) => item.grade === grade).map((item) => item.subject),
    [teaching, grade]
  );

  const refresh = useCallback(async () => {
    const response = await fetch("/api/assignments");
    if (response.ok) {
      const data = await response.json();
      setAssignments(data.assignments);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function assist() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/assignments/assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grade, subject, topic }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setTitle(data.draft.title);
      setInstructions(data.draft.instructions);
      setAnswerKey(data.draft.answerKey ?? "");
      setMessage("Local AI draft populated. You can edit instructions before publishing.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "AI assistant could not prepare draft.");
    } finally {
      setBusy(false);
    }
  }

  async function handleFileUpload(file: File, forAssignmentId?: string) {
    if (file.size > MAX_UPLOAD_FILE_BYTES) {
      setMessage("Choose a file smaller than 4 MB.");
      return;
    }
    const formData = new FormData();
    formData.append("file", file);
    if (!forAssignmentId) setUploadingAttachment(true);
    else setLearnerUploading((prev) => ({ ...prev, [forAssignmentId]: true }));
    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      if (!forAssignmentId) {
        setAttachmentUrl(data.url);
        setAttachmentType(data.type);
        setMessage("Assignment photo/file uploaded successfully.");
      } else {
        setLearnerAttachments((prev) => ({
          ...prev,
          [forAssignmentId]: { url: data.url, type: data.type },
        }));
        setMessage("Work photo uploaded. Click 'Submit Work' to finish.");
      }
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : "Upload failed");
    } finally {
      if (!forAssignmentId) setUploadingAttachment(false);
      else setLearnerUploading((prev) => ({ ...prev, [forAssignmentId]: false }));
    }
  }

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          instructions,
          grade,
          subject,
          dueAt: dueAt ? new Date(dueAt).toISOString() : undefined,
          maxScore: Number(maxScore),
          answerKey: answerKey || undefined,
          autoMark,
          attachmentUrl: attachmentUrl || undefined,
          attachmentType: attachmentType || undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setTitle("");
      setInstructions("");
      setTopic("");
      setAnswerKey("");
      setAttachmentUrl(null);
      setAttachmentType(null);
      setShowCreate(false);
      setMessage("Assignment published to learners successfully.");
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Assignment could not be published.");
    } finally {
      setBusy(false);
    }
  }

  async function submit(assignment: Assignment) {
    const responseText = answers[assignment.id]?.trim();
    const attached = learnerAttachments[assignment.id];
    if (!responseText && !attached) {
      setMessage("Please write an answer or upload a photo of your work before submitting.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(`/api/assignments/${assignment.id}/submissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          response: responseText || "Attached handwritten work",
          attachmentUrl: attached?.url,
          attachmentType: attached?.type,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setMessage(
        data.submission.status === "MARKED"
          ? `Submitted and marked: ${data.submission.score}/${assignment.maxScore}.`
          : "Your work was submitted to your teacher."
      );
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Answer could not be submitted.");
    } finally {
      setBusy(false);
    }
  }

  async function mark(
    assignment: Assignment,
    submission: Submission,
    score: string,
    feedback: string
  ) {
    setBusy(true);
    try {
      const response = await fetch(`/api/assignments/${assignment.id}/submissions`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          learnerId: submission.learnerId,
          score: Number(score),
          feedback,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setMessage(`${submission.learner?.name ?? "Learner"}’s work marked and updated.`);
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Work could not be marked.");
    } finally {
      setBusy(false);
    }
  }

  const filteredAssignments = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return assignments;
    return assignments.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        a.grade.toLowerCase().includes(q) ||
        a.subject.toLowerCase().includes(q)
    );
  }, [assignments, search]);

  // Aggregate stats
  const totalSubmissions = assignments.reduce((acc, a) => acc + a.submissions.length, 0);
  const totalMarked = assignments.reduce(
    (acc, a) => acc + a.submissions.filter((s) => s.status === "MARKED").length,
    0
  );

  return (
    <main className="mx-auto max-w-7xl p-4 pb-28 sm:p-6 md:p-8">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 p-6 text-white shadow-xl sm:p-8">
        <div className="relative z-10 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-blue-400/30 bg-blue-500/20 px-3 py-1 text-xs font-semibold text-blue-200 backdrop-blur-sm">
              <BookOpenCheck size={13} />
              CBC Learning Tasks
            </div>
            <h1 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">
              Coursework & Assignments
            </h1>
            <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-blue-100">
              {isTeacher
                ? "Post tasks for assigned classes, draft questions with local AI, review learner responses, and record constructive CBC feedback."
                : "Complete classwork tasks, submit your responses, and review teacher feedback."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {isTeacher && (
              <>
                <Link
                  href="/learning-content"
                  className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-4 text-xs font-bold text-white backdrop-blur-sm transition hover:bg-white/20"
                >
                  <BookOpen size={14} />
                  Content Library
                </Link>

                <button
                  onClick={() => setShowCreate(!showCreate)}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-white px-5 text-xs font-bold text-blue-900 shadow-md transition hover:bg-blue-50 active:scale-95"
                >
                  <Plus size={15} />
                  {showCreate ? "Close Creator" : "New Assignment"}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* KPI Bento Grid */}
      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="glass dark:glass-dark rounded-3xl border border-slate-200/80 p-5 shadow-sm dark:border-slate-800/80">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Total Tasks
            </span>
            <div className="rounded-xl bg-blue-50 p-2 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400">
              <BookOpenCheck size={16} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 dark:text-white">
              {assignments.length}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Published assignments</p>
        </div>

        <div className="glass dark:glass-dark rounded-3xl border border-slate-200/80 p-5 shadow-sm dark:border-slate-800/80">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Submissions
            </span>
            <div className="rounded-xl bg-indigo-50 p-2 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-400">
              <Users size={16} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-indigo-700 dark:text-indigo-400">
              {totalSubmissions}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Learner responses</p>
        </div>

        <div className="glass dark:glass-dark rounded-3xl border border-slate-200/80 p-5 shadow-sm dark:border-slate-800/80">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Graded Work
            </span>
            <div className="rounded-xl bg-emerald-50 p-2 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400">
              <CheckCircle2 size={16} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-700 dark:text-emerald-400">
              {totalMarked}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Evaluated with feedback</p>
        </div>

        <div className="glass dark:glass-dark rounded-3xl border border-slate-200/80 p-5 shadow-sm dark:border-slate-800/80">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              AI Drafting
            </span>
            <div className="rounded-xl bg-purple-50 p-2 text-purple-700 dark:bg-purple-950/60 dark:text-purple-400">
              <Sparkles size={16} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-sm font-black text-purple-700 dark:text-purple-400">
              Local Model Enabled
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Zero data leaves campus</p>
        </div>
      </div>

      {message && (
        <div
          role="status"
          className="mt-6 flex items-center gap-2 rounded-2xl border border-blue-200 bg-blue-50/90 p-4 text-xs font-semibold text-blue-900 shadow-sm dark:border-blue-900/60 dark:bg-blue-950/50 dark:text-blue-300"
        >
          <AlertCircle size={16} className="shrink-0" />
          <span>{message}</span>
        </div>
      )}

      {/* Create Assignment Form (Bento Expandable) */}
      {isTeacher && showCreate && (
        <form
          onSubmit={create}
          className="glass dark:glass-dark mt-6 rounded-3xl border border-blue-200/70 p-6 shadow-md transition-all sm:p-7 dark:border-blue-900/60"
        >
          <div className="mb-5 flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-600 text-white shadow-sm">
              <Plus size={18} />
            </span>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Create &amp; Publish Task
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Only learners in your assigned class will see this task in their portal.
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Grade / Class <span className="text-blue-600">*</span>
              </label>
              <select
                required
                value={grade}
                onChange={(e) => {
                  setGrade(e.target.value);
                  setSubject(teaching.find((item) => item.grade === e.target.value)?.subject ?? "");
                }}
                className="mt-1.5 min-h-11 w-full rounded-2xl border border-slate-200 bg-white/70 px-3 text-xs font-medium text-slate-900 outline-none focus:border-blue-600 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              >
                {[...new Set(teaching.map((item) => item.grade))].map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Learning Area (Subject) <span className="text-blue-600">*</span>
              </label>
              <select
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="mt-1.5 min-h-11 w-full rounded-2xl border border-slate-200 bg-white/70 px-3 text-xs font-medium text-slate-900 outline-none focus:border-blue-600 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              >
                {subjects.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Submission Due Date
              </label>
              <input
                type="datetime-local"
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
                className="mt-1.5 min-h-11 w-full rounded-2xl border border-slate-200 bg-white/70 px-3 text-xs font-medium text-slate-900 outline-none focus:border-blue-600 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Maximum Score <span className="text-blue-600">*</span>
              </label>
              <input
                type="number"
                min="1"
                max="1000"
                required
                value={maxScore}
                onChange={(e) => setMaxScore(e.target.value)}
                className="mt-1.5 min-h-11 w-full rounded-2xl border border-slate-200 bg-white/70 px-4 text-xs font-medium text-slate-900 outline-none focus:border-blue-600 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              />
            </div>
          </div>

          {/* AI Drafting Strip */}
          <div className="mt-4 rounded-2xl border border-purple-200/80 bg-purple-50/40 p-4 dark:border-purple-900/50 dark:bg-purple-950/20">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1">
                <label className="text-xs font-bold uppercase tracking-wider text-purple-900 dark:text-purple-300">
                  Topic for Local AI Assistant (Optional)
                </label>
                <input
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  maxLength={200}
                  placeholder="e.g. Proper fractions and improper fraction conversion"
                  className="mt-1.5 min-h-10 w-full rounded-xl border border-purple-200 bg-white px-3 text-xs text-slate-900 outline-none focus:border-purple-600 dark:border-purple-800 dark:bg-slate-900 dark:text-white"
                />
              </div>

              <button
                type="button"
                disabled={busy || !grade || !subject || topic.trim().length < 3}
                onClick={() => void assist()}
                className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-purple-700 px-4 text-xs font-bold text-white shadow-sm transition hover:bg-purple-800 disabled:opacity-40"
              >
                <Sparkles size={14} />
                Draft with Local AI
              </button>
            </div>
          </div>

          <div className="mt-4">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Task Title <span className="text-blue-600">*</span>
            </label>
            <input
              required
              minLength={3}
              maxLength={120}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Week 4 Mathematics Practice"
              className="mt-1.5 min-h-11 w-full rounded-2xl border border-slate-200 bg-white/70 px-4 text-xs font-medium text-slate-900 outline-none focus:border-blue-600 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            />
          </div>

          <div className="mt-4">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Instructions & Questions <span className="text-blue-600">*</span>
            </label>
            <textarea
              required
              minLength={5}
              maxLength={2000}
              rows={4}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="Write the questions, prompt, or activities for learners…"
              className="mt-1.5 w-full rounded-2xl border border-slate-200 bg-white/70 p-4 text-xs font-medium text-slate-900 outline-none focus:border-blue-600 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            />
          </div>

          <div className="mt-4">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Answer Key (Optional, for auto-marking)
            </label>
            <input
              maxLength={500}
              value={answerKey}
              onChange={(e) => setAnswerKey(e.target.value)}
              placeholder="Correct answer for instant automated evaluation"
              className="mt-1.5 min-h-11 w-full rounded-2xl border border-slate-200 bg-white/70 px-4 text-xs font-medium text-slate-900 outline-none focus:border-blue-600 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            />
          </div>

          <div className="mt-3">
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={autoMark}
                onChange={(e) => setAutoMark(e.target.checked)}
                className="h-4 w-4 rounded text-blue-600"
              />
              Automatically mark exact learner answers against the answer key
            </label>
          </div>

          {/* Scan or Photo of Assignment */}
          <div className="mt-4 rounded-2xl border border-blue-200/80 bg-blue-50/50 p-4 dark:border-blue-900/50 dark:bg-blue-950/20">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-blue-900 dark:text-blue-300 flex items-center gap-1.5">
                  <Camera size={14} />
                  Scan / Take Picture of Assignment (Optional)
                </label>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Snap a photo of the textbook page or handwritten questions for learners to see.
                </p>
              </div>

              <div>
                <label className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold cursor-pointer transition shadow-sm">
                  <Camera size={14} />
                  {uploadingAttachment ? "Uploading..." : "Take Photo / Choose File"}
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    capture="environment"
                    className="sr-only"
                    disabled={uploadingAttachment}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void handleFileUpload(file);
                    }}
                  />
                </label>
              </div>
            </div>

            {attachmentUrl && (
              <div className="mt-3 flex items-center gap-3 p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800">
                {attachmentType?.startsWith("image/") ? (
                  <img
                    src={attachmentUrl}
                    alt="Assignment preview"
                    className="h-14 w-14 rounded-lg object-cover border"
                  />
                ) : (
                  <div className="h-14 w-14 rounded-lg bg-blue-100 dark:bg-blue-900/60 flex items-center justify-center text-blue-700 dark:text-blue-300">
                    <FileText size={24} />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                    Attachment ready to publish
                  </p>
                  <a
                    href={attachmentUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-blue-600 hover:underline inline-flex items-center gap-1"
                  >
                    View file <ExternalLink size={10} />
                  </a>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setAttachmentUrl(null);
                    setAttachmentType(null);
                  }}
                  className="p-1 text-red-600 hover:bg-red-50 rounded-lg dark:hover:bg-red-950/40"
                  title="Remove attachment"
                >
                  <X size={16} />
                </button>
              </div>
            )}
          </div>

          <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              disabled={busy || !grade || !subject}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-700 px-6 text-xs font-bold text-white shadow-md shadow-blue-700/20 transition hover:bg-blue-800 disabled:opacity-50"
            >
              <Send size={14} />
              {busy ? "Publishing…" : "Publish to Learners"}
            </button>
          </div>
        </form>
      )}

      {/* Main Assignments List */}
      <section className="glass dark:glass-dark mt-6 rounded-3xl border border-slate-200/80 p-6 shadow-sm dark:border-slate-800/80">
        <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
          <div>
            <h2 className="text-lg font-black tracking-tight text-slate-900 dark:text-white">
              Assignments & Tasks
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Review published work, track submissions, and grade answers.
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
              placeholder="Search title, grade, or subject…"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50/70 py-2 pl-9 pr-4 text-xs font-medium text-slate-900 outline-none focus:border-blue-600 focus:bg-white dark:border-slate-700 dark:bg-slate-900/60 dark:text-white"
            />
          </div>
        </div>

        <div className="mt-6 space-y-5">
          {filteredAssignments.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 p-12 text-center dark:border-slate-800">
              <BookOpenCheck className="mx-auto text-blue-500" size={32} />
              <p className="mt-3 text-sm font-bold text-slate-900 dark:text-white">
                {isTeacher
                  ? "No assignments created yet"
                  : "No assignments published for your class"}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {isTeacher
                  ? "Create your first classwork task using the form above."
                  : "Your teachers will post tasks here when assigned."}
              </p>
            </div>
          ) : (
            filteredAssignments.map((assignment) => {
              const submission = assignment.submissions[0];
              const isLearnerUploading = learnerUploading[assignment.id];
              const currentLearnerAttachment = learnerAttachments[assignment.id];

              return (
                <article
                  key={assignment.id}
                  className="rounded-2xl border border-slate-200/80 bg-white/70 p-5 shadow-sm transition-all hover:border-blue-200 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/50"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[10px] font-bold text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                          {assignment.grade} · {assignment.subject}
                        </span>
                        {assignment.autoMark && (
                          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                            Auto-marked
                          </span>
                        )}
                        {assignment.attachmentUrl && (
                          <span className="rounded-full bg-purple-50 px-2 py-0.5 text-[10px] font-bold text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 flex items-center gap-1">
                            <Camera size={10} /> Photo/Scan Attached
                          </span>
                        )}
                      </div>
                      <h3 className="mt-1.5 text-base font-black tracking-tight text-slate-900 dark:text-white">
                        {assignment.title}
                      </h3>
                      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                        {assignment.dueAt
                          ? "Due " +
                            new Intl.DateTimeFormat("en-KE", {
                              dateStyle: "medium",
                              timeStyle: "short",
                              timeZone: "Africa/Nairobi",
                            }).format(new Date(assignment.dueAt))
                          : "No deadline specified"}{" "}
                        · Max {assignment.maxScore} marks
                      </p>
                    </div>

                    <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50/70 px-3 py-1 text-xs font-bold text-blue-800 dark:border-blue-800/60 dark:bg-blue-950/40 dark:text-blue-300">
                      <Users size={12} />
                      {assignment.submissions.length} Submissions
                    </span>
                  </div>

                  <div className="mt-4 rounded-2xl bg-slate-50/60 p-4 text-xs leading-relaxed text-slate-700 whitespace-pre-wrap dark:bg-slate-950/40 dark:text-slate-300">
                    {assignment.instructions}
                  </div>

                  {/* Scanned/Attached Picture from Teacher */}
                  {assignment.attachmentUrl && (
                    <div className="mt-3 p-3 rounded-2xl bg-slate-100/70 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                          <ImageIcon size={14} className="text-blue-600" />
                          Teacher&apos;s Scanned Assignment Sheet
                        </span>
                        <a
                          href={assignment.attachmentUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-semibold text-blue-600 hover:underline inline-flex items-center gap-1"
                        >
                          View Full Size <ExternalLink size={11} />
                        </a>
                      </div>

                      {assignment.attachmentType?.startsWith("image/") || (!assignment.attachmentType?.includes("pdf") && assignment.attachmentUrl.match(/\.(jpeg|jpg|png|webp|gif)$/i)) ? (
                        <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-black/5">
                          <img
                            src={assignment.attachmentUrl}
                            alt="Teacher's assignment sheet"
                            className="max-h-80 w-auto rounded-lg mx-auto object-contain cursor-pointer hover:opacity-95 transition"
                            onClick={() => window.open(assignment.attachmentUrl!, "_blank")}
                          />
                        </div>
                      ) : (
                        <div className="flex items-center gap-3 p-3 bg-white dark:bg-slate-900 rounded-xl">
                          <FileText size={24} className="text-blue-600 shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                              Assignment Document (PDF)
                            </p>
                          </div>
                          <a
                            href={assignment.attachmentUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shrink-0"
                          >
                            Open PDF
                          </a>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Learner View: Answer / Submission form */}
                  {isLearner && (
                    <div className="mt-4">
                      {submission?.status === "MARKED" ? (
                        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 dark:border-emerald-800 dark:bg-emerald-950/40">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-emerald-950 dark:text-emerald-200">
                              Graded Result
                            </span>
                            <span className="font-mono text-sm font-black text-emerald-700 dark:text-emerald-300">
                              Score: {submission.score} / {assignment.maxScore}
                            </span>
                          </div>
                          {submission.feedback && (
                            <p className="mt-2 text-xs text-emerald-800 dark:text-emerald-300">
                              Teacher Feedback: {submission.feedback}
                            </p>
                          )}
                          {submission.attachmentUrl && (
                            <div className="mt-2 pt-2 border-t border-emerald-200/60 dark:border-emerald-800/60">
                              <a
                                href={submission.attachmentUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs text-emerald-800 dark:text-emerald-300 font-semibold underline inline-flex items-center gap-1"
                              >
                                View your submitted photo/document <ExternalLink size={10} />
                              </a>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                            {submission ? "Update Your Submission" : "Your Answer"}
                          </label>
                          <textarea
                            rows={3}
                            maxLength={5000}
                            value={answers[assignment.id] ?? submission?.response ?? ""}
                            onChange={(e) =>
                              setAnswers((old) => ({ ...old, [assignment.id]: e.target.value }))
                            }
                            placeholder="Type your response here or upload a photo of your handwritten work below…"
                            className="w-full rounded-2xl border border-slate-200 bg-white p-3.5 text-xs text-slate-900 outline-none focus:border-blue-600 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                          />

                          {/* Upload photo of handwritten work */}
                          <div className="flex flex-wrap items-center gap-3">
                            <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer transition">
                              <Camera size={14} className="text-blue-600" />
                              {isLearnerUploading ? "Uploading photo..." : "Attach Photo of Handwritten Work"}
                              <input
                                type="file"
                                accept="image/*,application/pdf"
                                capture="environment"
                                className="sr-only"
                                disabled={isLearnerUploading}
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) void handleFileUpload(file, assignment.id);
                                }}
                              />
                            </label>

                            {(currentLearnerAttachment?.url || submission?.attachmentUrl) && (
                              <div className="inline-flex items-center gap-1.5 text-xs text-green-700 dark:text-green-400 font-semibold bg-green-50 dark:bg-green-950/40 px-2.5 py-1 rounded-lg">
                                <CheckCircle2 size={13} />
                                Photo attached
                                <a
                                  href={currentLearnerAttachment?.url || submission?.attachmentUrl || "#"}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="underline ml-1"
                                >
                                  View
                                </a>
                              </div>
                            )}
                          </div>

                          <button
                            disabled={busy}
                            onClick={() => void submit(assignment)}
                            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-700 px-5 text-xs font-bold text-white shadow-sm transition hover:bg-blue-800 disabled:opacity-50"
                          >
                            <Send size={14} />
                            Submit Work
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Teacher View: Submissions and Grading with LearnerLink */}
                  {isTeacher && assignment.submissions.length > 0 && (
                    <div className="mt-5 space-y-3 border-t border-slate-100 pt-4 dark:border-slate-800">
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Learner Submissions ({assignment.submissions.length})
                      </p>

                      <div className="space-y-3">
                        {assignment.submissions.map((sub) => (
                          <div
                            key={sub.id}
                            className="rounded-2xl border border-slate-200/70 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-900/40"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <LearnerLink
                                  id={sub.learner?.id || sub.learnerId}
                                  name={sub.learner?.name}
                                  admissionNo={sub.learner?.admissionNo}
                                  className="font-bold text-xs"
                                />
                                <span className="text-[10px] text-slate-400">•</span>
                                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-bold uppercase text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                                  {sub.status}
                                </span>
                              </div>

                              {sub.score !== null && (
                                <span className="font-mono text-xs font-bold text-emerald-700 dark:text-emerald-400">
                                  Mark: {sub.score} / {assignment.maxScore}
                                </span>
                              )}
                            </div>

                            <p className="mt-2 text-xs leading-relaxed text-slate-800 dark:text-slate-200 whitespace-pre-wrap">
                              {sub.response}
                            </p>

                            {/* Learner's attached photo of handwritten work */}
                            {sub.attachmentUrl && (
                              <div className="mt-2.5 p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  {sub.attachmentType?.startsWith("image/") || sub.attachmentUrl.match(/\.(jpeg|jpg|png|webp|gif)$/i) ? (
                                    <img
                                      src={sub.attachmentUrl}
                                      alt="Learner work"
                                      className="h-12 w-12 rounded object-cover border"
                                    />
                                  ) : (
                                    <FileText size={20} className="text-blue-600" />
                                  )}
                                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                    Learner Uploaded Handwritten Work
                                  </span>
                                </div>
                                <a
                                  href={sub.attachmentUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="px-2.5 py-1 text-xs font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 rounded-lg hover:underline inline-flex items-center gap-1"
                                >
                                  View Full Size <ExternalLink size={10} />
                                </a>
                              </div>
                            )}

                            {sub.status === "SUBMITTED" && (
                              <details className="mt-3 pt-2 border-t border-slate-200/60 dark:border-slate-800">
                                <summary className="cursor-pointer text-xs font-bold text-blue-700 hover:underline dark:text-blue-400">
                                  Evaluate &amp; Provide Feedback
                                </summary>
                                <MarkForm
                                  busy={busy}
                                  maxScore={assignment.maxScore}
                                  onSubmit={(score, feedback) =>
                                    mark(assignment, sub, score, feedback)
                                  }
                                />
                              </details>
                            )}

                            {sub.feedback && (
                              <p className="mt-2 text-[11px] text-slate-500 italic dark:text-slate-400">
                                Feedback: {sub.feedback}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </article>
              );
            })
          )}
        </div>
      </section>
    </main>
  );
}

function MarkForm({
  busy,
  maxScore,
  onSubmit,
}: {
  busy: boolean;
  maxScore: number;
  onSubmit: (score: string, feedback: string) => void;
}) {
  const [score, setScore] = useState("");
  const [feedback, setFeedback] = useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(score, feedback);
      }}
      className="mt-3 grid gap-3 sm:grid-cols-[130px_1fr_auto]"
    >
      <div>
        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
          Score (/{maxScore})
        </label>
        <input
          required
          type="number"
          min="0"
          max={maxScore}
          value={score}
          onChange={(e) => setScore(e.target.value)}
          className="mt-1 min-h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs outline-none focus:border-blue-600 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
        />
      </div>

      <div>
        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
          Comment / Guidance
        </label>
        <input
          maxLength={600}
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          placeholder="Constructive feedback for learner"
          className="mt-1 min-h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs outline-none focus:border-blue-600 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
        />
      </div>

      <div className="flex items-end">
        <button
          disabled={busy || score === ""}
          className="min-h-10 rounded-xl bg-blue-700 px-4 text-xs font-bold text-white shadow-sm hover:bg-blue-800 disabled:opacity-50"
        >
          Save Mark
        </button>
      </div>
    </form>
  );
}
