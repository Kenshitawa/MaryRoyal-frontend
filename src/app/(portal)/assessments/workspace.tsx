"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Calendar, Sparkles } from "lucide-react";
import { ThemedCard } from "@/components/design-system/card";
import { StatusPill } from "@/components/design-system/status-pill";
import { LearnerLink } from "@/components/learner-link";
import { PageHeader } from "@/components/ui/primitives";
import { InlineLoader, LoadingState } from "@/components/ui/loader";
import type { DataGridColumn, DataGridProps } from "@/components/application/data-grid/data-grid";
import { Select, SelectItem } from "@/components/base/select/select";
import { Input } from "@/components/base/input/input";
import { Button } from "@/components/base/buttons/button";
import { cbcLevel } from "@/lib/grading";
import { RiSaveLine } from "@remixicon/react";

type TeachingAssignment = { grade: string; subject: string };
type EntryRow = { learnerId: string; name: string; admissionNo: string; grade: string; mark: number | null };
type ClassResult = { learnerId: string; name: string; admissionNo: string; grade: string; score: number; level: string; status: string };

function createAssessmentGrid<T extends object>() {
  return dynamic<DataGridProps<T>>(
    () => import("@/components/application/data-grid/data-grid").then(({ DataGrid }) => {
      function AssessmentGrid(props: DataGridProps<T>) {
        return <DataGrid<T> {...props} />;
      }
      return AssessmentGrid;
    }),
    {
      ssr: false,
      loading: () => <LoadingState label="Loading assessment grid…" className="min-h-24 rounded-2xl bg-background-secondary-default py-4" />,
    },
  );
}

const EntryGrid = createAssessmentGrid<EntryRow>();
const ReviewGrid = createAssessmentGrid<ClassResult>();
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

const entryColumns: DataGridColumn<EntryRow>[] = [
  { key: "name", header: "Learner", width: 240, editable: false },
  { key: "admissionNo", header: "Admission number", width: 180, editable: false },
  {
    key: "mark",
    header: "Mark (0–100)",
    width: 150,
    type: "number",
    min: 0,
    max: 100,
    format: (value) => value === null ? "Enter mark" : `${value}%`,
  },
];

const reviewColumns: DataGridColumn<ClassResult>[] = [
  { key: "name", header: "Learner", width: 240, editable: false },
  { key: "admissionNo", header: "Admission number", width: 180, editable: false },
  { key: "score", header: "Mark", width: 120, editable: false, format: (value) => `${value}%` },
  { key: "level", header: "CBE level", width: 120, editable: false },
  { key: "status", header: "Status", width: 170, editable: false, format: (value) => value === "READY_TO_SAVE" ? "Ready to save" : value },
];

export default function AssessmentWorkspace({
  assignments,
  canViewLearnerProfiles,
  canCreate,
  canSubmit,
  canReview,
  canRelease
}: {
  assignments: TeachingAssignment[];
  canViewLearnerProfiles: boolean;
  canCreate: boolean;
  canSubmit: boolean;
  canReview: boolean;
  canRelease: boolean;
}) {
  const [rows, setRows] = useState<Assessment[]>([]);
  const [entryRows, setEntryRows] = useState<EntryRow[]>([]);
  const [existingClassResults, setExistingClassResults] = useState<ClassResult[]>([]);
  const [term, setTerm] = useState("2026 Term 1");
  const [selectedGrade, setSelectedGrade] = useState(assignments[0]?.grade ?? "");
  const [selectedSubject, setSelectedSubject] = useState(assignments[0]?.subject ?? "");
  const [strand, setStrand] = useState("");
  const [competency, setCompetency] = useState("");
  const [activeExams, setActiveExams] = useState<ExamSession[]>([]);
  const [selectedExamId, setSelectedExamId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingBatch, setSavingBatch] = useState(false);

  const gradeOptions = [...new Set(assignments.map((assignment) => assignment.grade))];
  const subjectOptions = [...new Set(assignments.filter((assignment) => assignment.grade === selectedGrade).map((assignment) => assignment.subject))];
  const enteredRows = entryRows.filter((row): row is EntryRow & { mark: number } => typeof row.mark === "number");
  const rowsForEntry = entryRows.filter((row) => row.mark === null);
  const classResults = [
    ...existingClassResults,
    ...enteredRows.map((row) => ({
      learnerId: row.learnerId,
      name: row.name,
      admissionNo: row.admissionNo,
      grade: row.grade,
      score: row.mark,
      level: cbcLevel(row.mark),
      status: "READY_TO_SAVE",
    })),
  ];

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const [assessmentResponse, examResponse] = await Promise.all([
      fetch(`/api/assessments?term=${encodeURIComponent(term)}&take=100`),
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

    if (canCreate && selectedGrade && selectedSubject) {
      const rosterResponse = await fetch(
        `/api/assessments?mode=roster&grade=${encodeURIComponent(selectedGrade)}&subject=${encodeURIComponent(selectedSubject)}&term=${encodeURIComponent(term)}`
      );
      if (rosterResponse.ok) {
        const rosterData = await rosterResponse.json();
        const learners = rosterData.learners as { id: string; name: string; admissionNo: string; grade: string }[];
        const learnerById = new Map(learners.map((learner) => [
          learner.id,
          { learnerId: learner.id, name: learner.name, admissionNo: learner.admissionNo, grade: learner.grade, mark: null },
        ]));
        const existing = (rosterData.existingAssessments as {
          learnerId: string; score: number; status: string;
        }[]).flatMap((assessment) => {
          const learner = learnerById.get(assessment.learnerId);
          return learner ? [{
            learnerId: learner.learnerId,
            name: learner.name,
            admissionNo: learner.admissionNo,
            grade: learner.grade,
            score: assessment.score,
            level: cbcLevel(assessment.score),
            status: assessment.status,
          }] : [];
        });
        const existingIds = new Set(existing.map((result) => result.learnerId));
        setExistingClassResults(existing);
        setEntryRows([...learnerById.values()].filter((learner) => !existingIds.has(learner.learnerId)));
      } else {
        const rosterData = await rosterResponse.json();
        setError(rosterData.error ?? "Could not load this assigned class.");
        setEntryRows([]);
        setExistingClassResults([]);
      }
    } else {
      setEntryRows([]);
      setExistingClassResults([]);
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
  }, [term, canCreate, selectedGrade, selectedSubject, selectedExamId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveBulkMarks() {
    if (!selectedGrade || !selectedSubject || enteredRows.length === 0) return;
    setSavingBatch(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/assessments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mode: "bulk",
          grade: selectedGrade,
          subject: selectedSubject,
          term,
          strand: strand || undefined,
          competency: competency || undefined,
          rows: enteredRows.map((row) => ({ learnerId: row.learnerId, score: row.mark })),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Class marks could not be saved.");
        return;
      }
      setMessage(`${data.assessments.length} marks saved as drafts. Review the CBE levels below before submitting.`);
      setStrand("");
      setCompetency("");
      await load();
    } catch {
      setError("Could not save class marks. Check the connection and try again.");
    } finally {
      setSavingBatch(false);
    }
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

  const rowActions = (r: Assessment) => (
    <div className="flex flex-wrap items-center gap-2">
      {canSubmit && ["DRAFT", "RETURNED"].includes(r.status) && (
        <>
          <button type="button" onClick={() => void editScore(r)} className="btn btn-secondary btn-sm">
            Edit
          </button>
          <button type="button" onClick={() => void workflow(r, "submit")} className="btn btn-primary btn-sm">
            Submit
          </button>
        </>
      )}
      {canReview && r.status === "SUBMITTED" && (
        <>
          <button type="button" onClick={() => void workflow(r, "approve")} className="btn btn-primary btn-sm">
            Approve
          </button>
          <button type="button" onClick={() => void workflow(r, "return")} className="btn btn-secondary btn-sm">
            Return
          </button>
        </>
      )}
      {canRelease && r.status === "APPROVED" && (
        <button type="button" onClick={() => void workflow(r, "release")} className="btn btn-primary btn-sm">
          Release
        </button>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="CBC Assessments & Results"
        help="Record competency-based scores, review submissions, and release official report cards."
        action={
          <>
            <Link href="/assessments/exams" className="btn btn-secondary btn-sm">
              <Calendar size={14} aria-hidden="true" /> Exam sessions
            </Link>
            <Link href="/assessments/rubrics" className="btn btn-secondary btn-sm">
              <Sparkles size={14} aria-hidden="true" /> CBC rubrics
            </Link>
            <select
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              aria-label="Assessment term"
              className="h-11 rounded-lg border border-white bg-white px-3 text-label font-semibold text-brand-ink"
            >
              {["2026 Term 1", "2026 Term 2", "2026 Term 3"].map((option) => (
                <option key={option} className="text-slate-900">{option}</option>
              ))}
            </select>
          </>
        }
      />

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

      {canCreate && (
        <ThemedCard className="space-y-5 p-5 sm:p-6">
          <div>
            <h2 className="text-title-3-semibold text-text-primary">Enter marks for a class</h2>
            <p className="mt-1 text-body-regular text-text-secondary">
              Choose an assigned class and learning area. Enter a mark in the grid; that learner moves into the review list.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Select
              label="Grade / class"
              selectedKey={selectedGrade}
              onSelectionChange={(key) => {
                if (!key) return;
                const grade = String(key);
                setSelectedGrade(grade);
                setSelectedSubject(assignments.find((assignment) => assignment.grade === grade)?.subject ?? "");
              }}
            >
              {gradeOptions.map((grade) => <SelectItem key={grade} id={grade}>{grade}</SelectItem>)}
            </Select>
            <Select
              label="Learning area"
              selectedKey={selectedSubject}
              onSelectionChange={(key) => { if (key) setSelectedSubject(String(key)); }}
              isDisabled={!subjectOptions.length}
            >
              {subjectOptions.map((subject) => <SelectItem key={subject} id={subject}>{subject}</SelectItem>)}
            </Select>
            <Input label="Assessment term" value={term} isReadOnly />
            <Input
              label="Strand (optional)"
              value={strand}
              onChange={setStrand}
              maxLength={100}
              placeholder="e.g. Numbers and Operations"
            />
            <Input
              label="Sub-strand / competency (optional)"
              value={competency}
              onChange={setCompetency}
              maxLength={160}
              placeholder="e.g. Multi-digit Addition"
            />
          </div>

          {assignments.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border-button-default p-5 text-body-regular text-text-secondary">
              No classes have been assigned to your account yet. Ask the school office to update your teaching allocation.
            </p>
          ) : (
            <>
              <EntryGrid
                aria-label={`${selectedGrade} ${selectedSubject} mark entry`}
                data={rowsForEntry}
                columns={entryColumns}
                getRowId={(row) => row.learnerId}
                onDataChange={(changedRows) => {
                  const changedById = new Map(changedRows.map((row) => [row.learnerId, row]));
                  setEntryRows((current) => current.map((row) => changedById.get(row.learnerId) ?? row));
                }}
                height={360}
                className="rounded-2xl border border-border-button-default bg-background-primary-default"
                emptyState="All learners in this class have a mark entered, or no approved learners are enrolled in this class."
                exportFileName={`${selectedGrade}-${selectedSubject}-marks.csv`}
              />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-body-regular text-text-secondary">
                  {enteredRows.length} mark(s) ready · {rowsForEntry.length} learner(s) still need a mark
                </p>
                <Button
                  leadingIcon={RiSaveLine}
                  disabled={!enteredRows.length || savingBatch}
                  onClick={() => void saveBulkMarks()}
                >
                  {savingBatch ? "Saving marks…" : `Save ${enteredRows.length} mark(s) as drafts`}
                </Button>
              </div>
            </>
          )}

          {classResults.length > 0 && (
            <section aria-labelledby="class-results-title" className="space-y-3 border-t border-separator-border pt-5">
              <div>
                <h3 id="class-results-title" className="text-title-3-semibold text-text-primary">Class results review</h3>
                <p className="mt-1 text-body-regular text-text-secondary">
                  CBE levels are calculated from each mark. New marks remain drafts until submitted through the review workflow.
                </p>
              </div>
              <ReviewGrid
                aria-label={`${selectedGrade} ${selectedSubject} class results review`}
                data={classResults}
                columns={reviewColumns}
                getRowId={(row) => row.learnerId}
                height={320}
                className="rounded-2xl border border-border-button-default bg-background-primary-default"
                exportFileName={`${selectedGrade}-${selectedSubject}-results.csv`}
              />
            </section>
          )}
        </ThemedCard>
      )}

      {/* Marks: cards on phones, table on wide screens */}
      <ThemedCard className="p-0 lg:hidden">
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {loading ? (
            <LoadingState label="Loading assessments…" className="min-h-32 gap-2 py-6" />
          ) : rows.length === 0 ? (
            <p className="p-6 text-center text-body text-ink-2">No assessments recorded yet for {term}.</p>
          ) : (
            rows.map(r => (
              <article key={r.id} className="min-w-0 p-4">
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <LearnerLink
                    id={r.learner.id || r.learnerId || ""}
                    name={r.learner.name}
                    admissionNo={r.learner.admissionNo}
                    disabled={!canViewLearnerProfiles}
                  />
                  <StatusPill status={r.status} />
                </div>
                <p className="mt-1 text-label text-ink-2">{r.learner.grade} · {r.subject}</p>
                <div className="mt-2 flex flex-wrap items-baseline gap-2">
                  <span className="text-kpi font-semibold text-ink tabular-nums">{r.score}%</span>
                  <span className="text-label font-semibold text-brand-ink">{r.level}</span>
                </div>
                {(r.strand || r.competency) && (
                  <p className="mt-1 text-label text-ink-2 break-words">
                    <span className="font-semibold text-ink">{r.strand || "—"}</span>
                    {r.competency ? ` · ${r.competency}` : ""}
                  </p>
                )}
                {r.reviewComment && (
                  <span className="mt-1 inline-block rounded bg-warning-soft px-1.5 py-0.5 text-caption font-semibold text-warning">
                    Returned: {r.reviewComment}
                  </span>
                )}
                <div className="mt-3">{rowActions(r)}</div>
              </article>
            ))
          )}
        </div>
      </ThemedCard>

      {/* Marks Table */}
      <ThemedCard className="overflow-hidden p-0">
        <div className="hidden overflow-x-auto lg:block">
          <table className="w-full min-w-[760px] text-left text-sm">
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
                    <InlineLoader label="Loading assessments…" />
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
                        disabled={!canViewLearnerProfiles}
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
