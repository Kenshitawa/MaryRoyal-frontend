"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Calendar, Sparkles } from "lucide-react";
import { ThemedCard } from "@/components/design-system/card";
import { StatusPill } from "@/components/design-system/status-pill";
import { LearnerLink } from "@/components/learner-link";

type Learner = { id: string; name: string; admissionNo: string; grade: string };
type Assessment = {
  id: string; subject: string; score: number; level: string; term: string; strand: string | null;
  competency: string | null; comment: string | null; reviewComment: string | null; status: string; version: number;
  learnerId?: string;
  learner: { id?: string; name: string; admissionNo: string; grade: string };
};

type ExamSession = {
  id: string;
  name: string;
  term: string;
  status: string;
  classes: string[];
};

export default function AssessmentWorkspace({
  subjects,
  canCreate,
  canSubmit,
  canReview,
  canRelease
}: {
  subjects: string[];
  canCreate: boolean;
  canSubmit: boolean;
  canReview: boolean;
  canRelease: boolean;
}) {
  const [learners, setLearners] = useState<Learner[]>([]);
  const [rows, setRows] = useState<Assessment[]>([]);
  const [term, setTerm] = useState("2026 Term 1");
  const [activeExams, setActiveExams] = useState<ExamSession[]>([]);
  const [selectedExamId, setSelectedExamId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const [assessmentResponse, learnerResponse, examResponse] = await Promise.all([
      fetch(`/api/assessments?term=${encodeURIComponent(term)}&take=100`),
      canCreate ? fetch("/api/learners?take=100") : Promise.resolve(null),
      fetch("/api/exams?status=ACTIVE")
    ]);

    if (!assessmentResponse.ok) {
      setError("Your account cannot view these assessments.");
      setRows([]);
      setLoading(false);
      return;
    }
    const data = await assessmentResponse.json();
    setRows(data.assessments);

    if (learnerResponse?.ok) {
      const learnerData = await learnerResponse.json();
      setLearners(learnerData.learners);
    }

    if (examResponse.ok) {
      const examData = await examResponse.json();
      const activeList = examData.exams || [];
      setActiveExams(activeList);
      if (activeList.length > 0 && !selectedExamId) {
        setSelectedExamId(activeList[0].id);
      }
    }

    setLoading(false);
  }, [term, canCreate, selectedExamId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function enter(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setError("");
    setMessage("");
    const values = Object.fromEntries(new FormData(form));
    const response = await fetch("/api/assessments", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...values,
        score: Number(values.score),
        examSessionId: selectedExamId || undefined
      })
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error ?? "Mark could not be saved.");
      return;
    }
    setMessage(`Mark saved successfully as ${data.assessment.level}.`);
    form.reset();
    void load();
  }

  async function editScore(row: Assessment) {
    const value = window.prompt("Revised mark (0–100):", String(row.score));
    if (value === null) return;
    const score = Number(value);
    if (!Number.isFinite(score) || score < 0 || score > 100) {
      setError("Enter a mark between 0 and 100.");
      return;
    }
    const response = await fetch("/api/assessments", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: row.id,
        score,
        strand: row.strand ?? undefined,
        competency: row.competency ?? undefined,
        comment: row.comment ?? undefined
      })
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error ?? "Mark could not be updated.");
      return;
    }
    setMessage("Mark updated and audit version history recorded.");
    void load();
  }

  async function workflow(row: Assessment, action: string) {
    setError("");
    setMessage("");
    const reason = action === "return" ? window.prompt("Reason for returning these marks?") : undefined;
    if (action === "return" && !reason) return;
    const response = await fetch(`/api/assessments/${row.id}/workflow`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action, ...(reason ? { reason } : {}) })
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error ?? "Workflow action failed.");
      return;
    }
    setMessage(`Assessment marked ${action}.`);
    void load();
  }

  return (
    <div className="space-y-6">
      {/* Top Header & Fast Navigation */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            CBC Assessments &amp; Results
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Record competency-based scores, review submissions, and release official report cards.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/assessments/exams"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
          >
            <Calendar size={14} className="text-blue-600" />
            <span>Exam Sessions</span>
          </Link>
          <Link
            href="/assessments/rubrics"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
          >
            <Sparkles size={14} className="text-indigo-600" />
            <span>CBC Rubrics</span>
          </Link>
          <label className="text-xs font-bold text-slate-600 dark:text-slate-400">
            <select
              value={term}
              onChange={e => setTerm(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
            >
              {["2026 Term 1", "2026 Term 2", "2026 Term 3"].map(t => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {/* Rubric Scale Quick Reference Strip */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200/80 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900 text-xs font-bold">
        <span className="text-slate-400 uppercase tracking-wider mr-1">Rubric Scale:</span>
        <span className="rounded-lg bg-emerald-50 px-2.5 py-1 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
          EE: 80 - 100% (Exceeding)
        </span>
        <span className="rounded-lg bg-blue-50 px-2.5 py-1 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300">
          ME: 60 - 79% (Meeting)
        </span>
        <span className="rounded-lg bg-amber-50 px-2.5 py-1 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
          AE: 40 - 59% (Approaching)
        </span>
        <span className="rounded-lg bg-rose-50 px-2.5 py-1 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300">
          BE: 0 - 39% (Below)
        </span>
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

      {/* Active Exam Sessions Banner for Teachers */}
      {activeExams.length > 0 && (
        <div className="rounded-2xl bg-gradient-to-r from-blue-900 to-indigo-900 p-4 text-white shadow-md flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-white/20">
              <Calendar size={16} />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-blue-200">Active Exam Window</p>
              <p className="text-sm font-extrabold">{activeExams[0].name}</p>
            </div>
          </div>
          <span className="rounded-full bg-emerald-400/20 px-3 py-1 text-xs font-bold text-emerald-300 border border-emerald-400/30">
            Marks entry open
          </span>
        </div>
      )}

      {/* Entry Form */}
      {canCreate && (
        <ThemedCard className="p-5 sm:p-6">
          <form onSubmit={enter} className="space-y-4">
            <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
              Enter Learner Assessment Mark
            </h2>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Learner
                </label>
                <select
                  name="learnerId"
                  required
                  className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-800 dark:bg-slate-900"
                >
                  <option value="">Select learner</option>
                  {learners.map(l => (
                    <option key={l.id} value={l.id}>
                      {l.name} · {l.admissionNo} · {l.grade}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Subject
                </label>
                <select
                  name="subject"
                  required
                  className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-800 dark:bg-slate-900"
                >
                  {subjects.map(s => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Score (0–100)
                </label>
                <input
                  name="score"
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  required
                  placeholder="e.g. 78.5"
                  className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-800 dark:bg-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Term
                </label>
                <input
                  name="term"
                  value={term}
                  readOnly
                  className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Strand (Learning Area)
                </label>
                <input
                  name="strand"
                  maxLength={100}
                  placeholder="e.g. Numbers and Operations"
                  className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-800 dark:bg-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Sub-Strand / Competency
                </label>
                <input
                  name="competency"
                  maxLength={160}
                  placeholder="e.g. Multi-digit Addition"
                  className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-800 dark:bg-slate-900"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Teacher Observational Comment
                </label>
                <input
                  name="comment"
                  maxLength={500}
                  placeholder="e.g. Demonstrates solid problem-solving confidence."
                  className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-800 dark:bg-slate-900"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                className="rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-md hover:bg-blue-700 active:scale-95"
              >
                Save Assessment Mark
              </button>
            </div>
          </form>
        </ThemedCard>
      )}

      {/* Marks Table */}
      <ThemedCard className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50/70 text-xs uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800/40">
              <tr>
                <th className="px-4 py-3.5">Learner</th>
                <th className="px-4 py-3.5">Grade</th>
                <th className="px-4 py-3.5">Subject</th>
                <th className="px-4 py-3.5">Score</th>
                <th className="px-4 py-3.5">CBC Level</th>
                <th className="px-4 py-3.5">Strand &amp; Competency</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400">
                    Loading assessments...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-slate-400">
                    No assessments recorded yet for {term}.
                  </td>
                </tr>
              ) : (
                rows.map(r => (
                  <tr key={r.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-3.5">
                      <LearnerLink
                        id={r.learner.id || r.learnerId || ""}
                        name={r.learner.name}
                        admissionNo={r.learner.admissionNo}
                      />
                    </td>
                    <td className="px-4 py-3.5 text-slate-700 dark:text-slate-300">{r.learner.grade}</td>
                    <td className="px-4 py-3.5 font-semibold text-slate-800 dark:text-slate-200">{r.subject}</td>
                    <td className="px-4 py-3.5 font-extrabold text-slate-900 dark:text-white">{r.score}%</td>
                    <td className="px-4 py-3.5">
                      <span className="font-bold text-blue-700 dark:text-blue-300">
                        {r.level}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 max-w-xs">
                      <p className="text-xs font-semibold truncate text-slate-700 dark:text-slate-300">
                        {r.strand || "—"}
                      </p>
                      <p className="text-[11px] text-slate-400 truncate">
                        {r.competency || ""}
                      </p>
                      {r.reviewComment && (
                        <span className="inline-block mt-0.5 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                          Returned: {r.reviewComment}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <StatusPill status={r.status} />
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {canSubmit && ["DRAFT", "RETURNED"].includes(r.status) && (
                          <>
                            <button
                              onClick={() => void editScore(r)}
                              className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => void workflow(r, "submit")}
                              className="rounded-lg bg-blue-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-blue-700 shadow-sm"
                            >
                              Submit
                            </button>
                          </>
                        )}
                        {canReview && r.status === "SUBMITTED" && (
                          <>
                            <button
                              onClick={() => void workflow(r, "approve")}
                              className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-emerald-700 shadow-sm"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => void workflow(r, "return")}
                              className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300"
                            >
                              Return
                            </button>
                          </>
                        )}
                        {canRelease && r.status === "APPROVED" && (
                          <button
                            onClick={() => void workflow(r, "release")}
                            className="rounded-lg bg-blue-700 px-3 py-1 text-xs font-bold text-white hover:bg-blue-800 shadow-sm"
                          >
                            Release
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </ThemedCard>
    </div>
  );
}
