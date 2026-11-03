"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Plus, CheckCircle2, Lock, Unlock, AlertCircle } from "lucide-react";
import { ThemedCard } from "@/components/design-system/card";
import { PageHeader } from "@/components/ui/primitives";
import { StatusPill } from "@/components/design-system/status-pill";

interface ExamSession {
  id: string;
  name: string;
  term: string;
  status: string;
  classes: string[];
  subjects: string[];
  startDate: string | null;
  endDate: string | null;
  progressPercent: number;
  expectedMarks: number;
  submittedMarks: number;
  reopenReason: string | null;
  createdBy: { id: string; name: string };
}

const standardGrades = ["PP1", "PP2", ...Array.from({ length: 9 }, (_, i) => `Grade ${i + 1}`)];
const standardSubjects = [
  "Mathematics",
  "English",
  "Kiswahili",
  "Integrated Science",
  "Social Studies",
  "CRE",
  "Creative Arts",
  "Agriculture"
];

export default function ExamSessionsClient({
  canManage,
  canApprove
}: {
  canManage: boolean;
  canApprove: boolean;
}) {
  const [exams, setExams] = useState<ExamSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("2026 Term 1 End-Term Assessment");
  const [term, setTerm] = useState("2026 Term 1");
  const [selectedGrades, setSelectedGrades] = useState<string[]>(["Grade 1", "Grade 2", "Grade 3", "Grade 4"]);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>(standardSubjects.slice(0, 5));
  const [status, setStatus] = useState<"DRAFT" | "ACTIVE">("ACTIVE");
  const [reopenId, setReopenId] = useState<string | null>(null);
  const [reopenReason, setReopenReason] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const fetchExams = useCallback(async () => {
    try {
      const res = await fetch("/api/exams");
      if (res.ok) {
        const data = await res.json();
        setExams(data.exams || []);
      }
    } catch {
      // fallback
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchExams();
  }, [fetchExams]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setNotice("");
    try {
      const res = await fetch("/api/exams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          term,
          status,
          classes: selectedGrades,
          subjects: selectedSubjects,
          timetable: []
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create exam session");
      setNotice(`Exam session "${name}" created successfully.`);
      setShowCreate(false);
      await fetchExams();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Error creating exam session");
    } finally {
      setBusy(false);
    }
  };

  const updateStatus = async (id: string, newStatus: string, reason?: string) => {
    setBusy(true);
    setNotice("");
    try {
      const res = await fetch(`/api/exams/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus, reopenReason: reason })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update status");
      setNotice(`Exam session status changed to ${newStatus}.`);
      setReopenId(null);
      setReopenReason("");
      await fetchExams();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Status update failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Exam Sessions & Timetables"
        help="The Deputy Head Teacher schedules term exam sessions. Teachers can only enter marks for active sessions."
        action={
          canManage ? (
            <button onClick={() => setShowCreate(!showCreate)} className="btn btn-primary btn-sm">
              <Plus size={16} aria-hidden="true" /> {showCreate ? "Cancel" : "New exam session"}
            </button>
          ) : undefined
        }
      />

      {notice && (
        <div className="rounded-xl bg-blue-50 p-4 text-sm font-semibold text-blue-900 dark:bg-blue-950/50 dark:text-blue-200">
          {notice}
        </div>
      )}

      {/* Creation Modal / Card */}
      {showCreate && (
        <ThemedCard className="border-blue-300 dark:border-blue-900 shadow-lg">
          <form onSubmit={handleCreate} className="space-y-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Schedule New Term Exam Session
            </h2>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                  Exam Session Name
                </label>
                <input
                  required
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. 2026 Term 1 Mid-Term Assessment"
                  className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-800 dark:bg-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                  Academic Term
                </label>
                <input
                  required
                  type="text"
                  value={term}
                  onChange={e => setTerm(e.target.value)}
                  placeholder="2026 Term 1"
                  className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-800 dark:bg-slate-900"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                Initial Status
              </label>
              <div className="mt-2 flex gap-4">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input
                    type="radio"
                    name="initialStatus"
                    checked={status === "ACTIVE"}
                    onChange={() => setStatus("ACTIVE")}
                    className="text-blue-600"
                  />
                  <span>Active (Open marks entry for teachers immediately)</span>
                </label>
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input
                    type="radio"
                    name="initialStatus"
                    checked={status === "DRAFT"}
                    onChange={() => setStatus("DRAFT")}
                    className="text-blue-600"
                  />
                  <span>Draft (Planning stage, locked)</span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-2">
                Classes Included
              </label>
              <div className="flex flex-wrap gap-2">
                {standardGrades.map(grade => {
                  const selected = selectedGrades.includes(grade);
                  return (
                    <button
                      type="button"
                      key={grade}
                      onClick={() => {
                        setSelectedGrades(prev =>
                          selected ? prev.filter(g => g !== grade) : [...prev, grade]
                        );
                      }}
                      className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                        selected
                          ? "bg-blue-600 text-white shadow-sm"
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                      }`}
                    >
                      {grade}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-2">
                Learning Areas / Subjects Included
              </label>
              <div className="flex flex-wrap gap-2">
                {standardSubjects.map(subj => {
                  const selected = selectedSubjects.includes(subj);
                  return (
                    <button
                      type="button"
                      key={subj}
                      onClick={() => {
                        setSelectedSubjects(prev =>
                          selected ? prev.filter(s => s !== subj) : [...prev, subj]
                        );
                      }}
                      className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                        selected
                          ? "bg-blue-600 text-white shadow-sm"
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                      }`}
                    >
                      {subj}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy || selectedGrades.length === 0}
                className="rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-md hover:bg-blue-700 disabled:opacity-50"
              >
                {busy ? "Scheduling..." : "Confirm & Schedule Exam"}
              </button>
            </div>
          </form>
        </ThemedCard>
      )}

      {/* Reopen Dialog */}
      {reopenId && (
        <ThemedCard className="border-amber-300 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20">
          <div className="space-y-3">
            <h3 className="text-base font-bold text-amber-900 dark:text-amber-200">
              Reopen Exam Marks Entry
            </h3>
            <p className="text-xs text-amber-800 dark:text-amber-300">
              Reopening a closed exam session requires a logged reason and Head Teacher / Director approval.
            </p>
            <textarea
              required
              rows={2}
              value={reopenReason}
              onChange={e => setReopenReason(e.target.value)}
              placeholder="State why marks entry is being reopened (e.g. absent learner sitting makeup exam)..."
              className="w-full rounded-xl border border-amber-200 bg-white p-3 text-sm dark:border-amber-900/60 dark:bg-slate-900"
            />
            <div className="flex gap-2">
              <button
                disabled={busy || reopenReason.trim().length < 5}
                onClick={() => updateStatus(reopenId, "ACTIVE", reopenReason)}
                className="rounded-lg bg-amber-600 px-4 py-2 text-xs font-bold text-white hover:bg-amber-700 disabled:opacity-50"
              >
                Approve &amp; Reopen
              </button>
              <button
                onClick={() => setReopenId(null)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 dark:border-slate-700 dark:text-slate-300"
              >
                Cancel
              </button>
            </div>
          </div>
        </ThemedCard>
      )}

      {/* Exam Sessions List */}
      <div className="space-y-4">
        {loading ? (
          <p className="p-8 text-center text-sm text-slate-500">Loading exam sessions...</p>
        ) : exams.length === 0 ? (
          <ThemedCard className="p-12 text-center">
            <AlertCircle className="mx-auto text-blue-500" size={32} />
            <h3 className="mt-3 text-lg font-bold text-slate-800 dark:text-white">
              No Exam Sessions Scheduled
            </h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              The Deputy Head Teacher can create Opening, Mid-Term, or End-Term sessions above.
            </p>
          </ThemedCard>
        ) : (
          exams.map(exam => {
            const isActive = exam.status === "ACTIVE";
            const isClosed = exam.status === "CLOSED";

            return (
              <ThemedCard key={exam.id} className="p-5 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5">
                      <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
                        {exam.name}
                      </h2>
                      <StatusPill status={exam.status} />
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {exam.term} · Scheduled by {exam.createdBy.name}
                    </p>
                  </div>

                  {canManage && (
                    <div className="flex flex-wrap items-center gap-2">
                      {isActive && (
                        <button
                          disabled={busy}
                          onClick={() => updateStatus(exam.id, "CLOSED")}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300"
                        >
                          <Lock size={13} />
                          <span>Close Marks Entry</span>
                        </button>
                      )}
                      {isClosed && (
                        <>
                          <button
                            disabled={busy}
                            onClick={() => setReopenId(exam.id)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 px-3 py-1.5 text-xs font-bold text-amber-800 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-300"
                          >
                            <Unlock size={13} />
                            <span>Reopen</span>
                          </button>
                        </>
                      )}
                      {exam.status === "DRAFT" && (
                        <button
                          disabled={busy}
                          onClick={() => updateStatus(exam.id, "ACTIVE")}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700"
                        >
                          <Unlock size={13} />
                          <span>Activate Session</span>
                        </button>
                      )}
                    </div>
                  )}
                  {isClosed && canApprove && (
                    <button
                      disabled={busy}
                      onClick={() => updateStatus(exam.id, "PUBLISHED")}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700"
                    >
                      <CheckCircle2 size={13} />
                      <span>Approve &amp; Publish Results</span>
                    </button>
                  )}
                </div>

                {/* Progress Bar */}
                <div className="mt-5 space-y-1.5">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-slate-600 dark:text-slate-400">
                      Marks Submission Progress
                    </span>
                    <span className="text-blue-700 dark:text-blue-300">
                      {exam.submittedMarks} recorded ({exam.progressPercent}%)
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-blue-700 to-blue-500 transition-all duration-500"
                      style={{ width: `${Math.min(100, exam.progressPercent)}%` }}
                    />
                  </div>
                </div>

                {/* Classes & Subjects */}
                <div className="mt-5 grid gap-4 border-t border-slate-100 pt-4 dark:border-slate-800 sm:grid-cols-2">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Assigned Classes ({exam.classes.length})
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {exam.classes.map(c => (
                        <span
                          key={c}
                          className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                        >
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Subjects Evaluated ({exam.subjects.length})
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {exam.subjects.map(s => (
                        <span
                          key={s}
                          className="rounded-md bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-800 dark:bg-blue-950/60 dark:text-blue-300"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {exam.reopenReason && (
                  <p className="mt-3 rounded-lg bg-amber-50 p-2 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                    <strong>Reopen note:</strong> {exam.reopenReason}
                  </p>
                )}
              </ThemedCard>
            );
          })
        )}
      </div>
    </div>
  );
}
