"use client";

import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/base/input/input";
import { Select, SelectItem } from "@/components/base/select/select";
import { PageHeader } from "@/components/ui/primitives";
import { cbcLevel } from "@/lib/grading";

type Assignment = { grade: string; subject: string };
type AcademicRecord = {
  id: string;
  score: number;
  term: string;
  strand: string | null;
  competency: string | null;
  status: string;
};
type ClassTask = {
  id: string;
  title: string;
  dueAt: string | null;
  maxScore: number;
  submission: { score: number | null; status: string; submittedAt: string | null } | null;
};
type AcademicLearner = {
  id: string;
  name: string;
  assessments: AcademicRecord[];
  assignments: ClassTask[];
};
type Roster = { learners: AcademicLearner[] };

export default function TeacherAcademicRoster({ assignments }: { assignments: Assignment[] }) {
  const [selected, setSelected] = useState(assignments[0] ? `${assignments[0].grade}::${assignments[0].subject}` : "");
  const [roster, setRoster] = useState<Roster>({ learners: [] });
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const activeAssignment = assignments.find((item) => `${item.grade}::${item.subject}` === selected);
  useEffect(() => {
    const controller = new AbortController();
    if (!activeAssignment) {
      setRoster({ learners: [] });
      setLoading(false);
      setError("");
      return () => controller.abort();
    }
    setLoading(true);
    setError("");
    void (async () => {
      try {
        const query = new URLSearchParams(activeAssignment);
        const response = await fetch(`/api/learners/academics?${query}`, { signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Academic records could not be loaded.");
        setRoster(data);
      } catch (cause) {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : "Academic records could not be loaded.");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [activeAssignment]);

  const learners = useMemo(() => {
    const query = search.trim().toLowerCase();
    return roster.learners.filter((learner) => !query || learner.name.toLowerCase().includes(query));
  }, [roster.learners, search]);

  return (
    <section className="mx-auto max-w-7xl space-y-4 p-4 pb-28 sm:p-6 md:p-8">
      <PageHeader
        title="Class learning records"
        help="Choose an assigned class to review academic results, assignments and learning strengths. Personal profiles are not available in this view."
      />

      <div className="grid gap-3 rounded-3xl border border-border-button-default bg-background-primary-default p-5 sm:grid-cols-2">
        <Select label="Assigned class and learning area" selectedKey={selected} onSelectionChange={(key) => setSelected(String(key ?? ""))}>
          {assignments.map((item) => {
            const key = `${item.grade}::${item.subject}`;
            return <SelectItem key={key} id={key}>{item.grade} · {item.subject}</SelectItem>;
          })}
        </Select>
        <Input label="Search learners in this class" value={search} onChange={setSearch} placeholder="Learner name" />
      </div>

      {error && <p role="alert" className="rounded-xl border border-border-error-default bg-background-primary-default p-4 text-body-2-regular text-text-error-primary">{error}</p>}
      {loading && <p role="status" className="text-body-2-regular text-text-secondary">Loading academic records…</p>}
      {!loading && !error && assignments.length === 0 && (
        <p className="rounded-3xl border border-border-button-default bg-background-primary-default p-5 text-body-regular text-text-secondary">No classes are assigned to your account yet.</p>
      )}
      {!loading && !error && assignments.length > 0 && learners.length === 0 && (
        <p className="rounded-3xl border border-border-button-default bg-background-primary-default p-5 text-body-regular text-text-secondary">No learners or matching names found for this class.</p>
      )}

      <ul className="space-y-3">
        {learners.map((learner) => {
          const released = learner.assessments.filter((record) => record.status === "RELEASED");
          const byStrand = new Map<string, number[]>();
          for (const record of released) {
            const strand = record.strand?.trim() || record.competency?.trim() || "Learning area";
            byStrand.set(strand, [...(byStrand.get(strand) ?? []), record.score]);
          }
          const learningAreas = [...byStrand.entries()].map(([strand, scores]) => {
            const average = scores.reduce((sum, score) => sum + score, 0) / scores.length;
            return { strand, average: Math.round(average), level: cbcLevel(average) };
          });
          const strengths = learningAreas.filter((area) => area.level === "EE" || area.level === "ME");
          const supportAreas = learningAreas.filter((area) => area.level === "AE" || area.level === "BE");

          return (
            <li key={learner.id} className="rounded-3xl border border-border-button-default bg-background-primary-default p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-title-3-semibold text-text-primary">{learner.name}</h2>
                  <p className="mt-1 text-body-2-regular text-text-secondary">{activeAssignment?.grade} · {activeAssignment?.subject}</p>
                </div>
                <span className="rounded-full bg-background-secondary-default px-3 py-1 text-caption-1-semibold text-text-secondary">
                  {released.length} released result{released.length === 1 ? "" : "s"}
                </span>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <section aria-label={`${learner.name} CBE learning strengths`} className="rounded-2xl bg-background-secondary-default p-4">
                  <h3 className="text-body-medium text-text-primary">Learning strengths &amp; support areas</h3>
                  {learningAreas.length === 0 ? (
                    <p className="mt-2 text-body-2-regular text-text-secondary">No released results yet. CBE summaries will appear after results are released.</p>
                  ) : (
                    <div className="mt-3 space-y-2">
                      <p className="text-body-2-regular text-text-secondary">
                        Strengths: {strengths.map((area) => `${area.strand} (${area.level})`).join(", ") || "No area is rated ME or EE yet."}
                      </p>
                      <p className="text-body-2-regular text-text-secondary">
                        Support: {supportAreas.map((area) => `${area.strand} (${area.level})`).join(", ") || "No area is currently rated AE or BE."}
                      </p>
                    </div>
                  )}
                </section>

                <section aria-label={`${learner.name} assignments`} className="rounded-2xl bg-background-secondary-default p-4">
                  <h3 className="text-body-medium text-text-primary">Assignments provided</h3>
                  {learner.assignments.length === 0 ? (
                    <p className="mt-2 text-body-2-regular text-text-secondary">No assignments have been set for this class and learning area.</p>
                  ) : (
                    <ul className="mt-2 space-y-2">
                      {learner.assignments.map((task) => (
                        <li key={task.id} className="flex flex-wrap justify-between gap-2 text-body-2-regular text-text-secondary">
                          <span>{task.title}</span>
                          <span>
                            {task.submission?.status ?? "Not submitted"}
                            {task.submission?.score != null ? ` · ${task.submission.score}/${task.maxScore}` : ""}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </div>

              <div className="mt-4 border-t border-separator-border pt-4">
                <h3 className="text-body-medium text-text-primary">CBE assessment history</h3>
                {learner.assessments.length === 0 ? (
                  <p className="mt-2 text-body-2-regular text-text-secondary">No assessment records are available for this learning area.</p>
                ) : (
                  <ul className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    {learner.assessments.map((record) => (
                      <li key={record.id} className="rounded-xl border border-separator-border p-3">
                        <p className="text-body-2-medium text-text-primary">{record.strand || record.competency || "Assessment"} · {record.term}</p>
                        <p className="mt-1 text-body-2-regular text-text-secondary">
                          {record.status === "RELEASED" ? `${record.score}% · ${cbcLevel(record.score)}` : "Awaiting release"}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
