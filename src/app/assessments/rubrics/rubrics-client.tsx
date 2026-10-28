"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, AlertTriangle, Save } from "lucide-react";
import { ThemedCard } from "@/components/design-system/card";

interface RubricLevel {
  id?: string;
  code: string;
  label: string;
  minScore: number;
  maxScore: number;
  descriptor: string;
  color: string;
  learningArea?: string;
  gradeBand?: string;
}

const defaultCbcLevels: RubricLevel[] = [
  {
    code: "EE",
    label: "Exceeding Expectations",
    minScore: 80,
    maxScore: 100,
    descriptor: "Learner consistently demonstrates mastery and exceeds expected competencies.",
    color: "#059669" // Emerald
  },
  {
    code: "ME",
    label: "Meeting Expectations",
    minScore: 60,
    maxScore: 79.99,
    descriptor: "Learner successfully demonstrates the expected curriculum competency.",
    color: "#2563eb" // Blue
  },
  {
    code: "AE",
    label: "Approaching Expectations",
    minScore: 40,
    maxScore: 59.99,
    descriptor: "Learner is developing the competency and makes steady progress with regular guidance.",
    color: "#d97706" // Amber
  },
  {
    code: "BE",
    label: "Below Expectations",
    minScore: 0,
    maxScore: 39.99,
    descriptor: "Learner requires structured intervention and targeted support to attain competency.",
    color: "#e11d48" // Rose
  }
];

export default function RubricsClient({ canManage }: { canManage: boolean }) {
  const [levels, setLevels] = useState<RubricLevel[]>(defaultCbcLevels);
  const [totalAssessments, setTotalAssessments] = useState(0);
  const [confirmImpact, setConfirmImpact] = useState(false);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const fetchRubrics = useCallback(async () => {
    try {
      const res = await fetch("/api/rubrics");
      if (res.ok) {
        const data = await res.json();
        if (data.rubrics && data.rubrics.length > 0) {
          setLevels(data.rubrics);
        }
        setTotalAssessments(data.totalAssessments || 0);
      }
    } catch {
      // Keep the configured defaults when the rubric endpoint is unavailable.
    }
  }, []);

  useEffect(() => {
    void fetchRubrics();
  }, [fetchRubrics]);

  const updateLevel = (index: number, field: keyof RubricLevel, val: unknown) => {
    setLevels(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: val };
      return copy;
    });
  };

  const addSubLevel = () => {
    setLevels(prev => [
      ...prev,
      {
        code: "ME-2",
        label: "Meeting Expectations (High)",
        minScore: 70,
        maxScore: 79.99,
        descriptor: "High performance meeting expected standard.",
        color: "#3b82f6"
      }
    ]);
  };

  const removeLevel = (index: number) => {
    if (levels.length <= 2) return;
    setLevels(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    setBusy(true);
    setNotice("");
    try {
      const res = await fetch("/api/rubrics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          levels,
          effectiveDate: new Date().toISOString()
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save rubrics");
      setNotice(`Central CBC Rubric successfully updated. Total marks impacted: ${data.impact?.assessmentsImpacted ?? 0}.`);
      setConfirmImpact(false);
      await fetchRubrics();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Error saving rubrics");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            CBC Performance Scales &amp; Rubrics
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Centrally defined CBC proficiency levels (EE, ME, AE, BE) for Mary Royal School. All subject scores map automatically.
          </p>
        </div>

        {canManage && (
          <div className="flex items-center gap-3">
            <button
              onClick={addSubLevel}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300"
            >
              <Plus size={15} />
              <span>Add Sub-Level</span>
            </button>
            <button
              onClick={() => {
                if (totalAssessments > 0) {
                  setConfirmImpact(true);
                } else {
                  void handleSave();
                }
              }}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
            >
              <Save size={15} />
              <span>Save Central Rubric</span>
            </button>
          </div>
        )}
      </div>

      {notice && (
        <div className="rounded-xl bg-blue-50 p-4 text-sm font-semibold text-blue-900 dark:bg-blue-950/50 dark:text-blue-200">
          {notice}
        </div>
      )}

      {/* Impact Warning Confirmation Dialog */}
      {confirmImpact && (
        <ThemedCard className="border-amber-300 bg-amber-50/70 dark:border-amber-900 dark:bg-amber-950/30">
          <div className="flex items-start gap-4">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200">
              <AlertTriangle size={22} />
            </div>
            <div className="space-y-2">
              <h3 className="text-base font-bold text-amber-900 dark:text-amber-100">
                Confirm Rubric Boundary Update
              </h3>
              <p className="text-xs text-amber-800 dark:text-amber-200 leading-relaxed">
                There are currently <strong>{totalAssessments} assessment marks</strong> in the system. Modifying score boundaries will create a new version of the school rubric and re-evaluate draft/submitted assessments. Published report cards will retain their original rubric version. This action will be recorded in the audit trail.
              </p>
              <div className="flex gap-2 pt-2">
                <button
                  disabled={busy}
                  onClick={() => void handleSave()}
                  className="rounded-lg bg-amber-700 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-amber-800 disabled:opacity-50"
                >
                  {busy ? "Applying Changes..." : "I Understand, Update Rubric"}
                </button>
                <button
                  onClick={() => setConfirmImpact(false)}
                  className="rounded-lg border border-amber-300 px-3 py-2 text-xs font-bold text-amber-900 hover:bg-amber-100 dark:border-amber-800 dark:text-amber-200"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </ThemedCard>
      )}

      {/* Rubric Levels Cards */}
      <div className="space-y-4">
        {levels.map((level, idx) => (
          <ThemedCard key={level.code + idx} className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <span
                  className="h-4 w-4 rounded-full"
                  style={{ backgroundColor: level.color }}
                  aria-hidden="true"
                />
                <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">
                  {level.code} — {level.label}
                </h3>
              </div>

              {canManage && levels.length > 2 && (
                <button
                  type="button"
                  onClick={() => removeLevel(idx)}
                  className="text-slate-400 hover:text-rose-600 transition"
                  title="Remove this level"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <div>
                <label htmlFor={`rubric-${idx}-code`} className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Code
                </label>
                <input
                  id={`rubric-${idx}-code`}
                  disabled={!canManage}
                  type="text"
                  value={level.code}
                  onChange={e => updateLevel(idx, "code", e.target.value.toUpperCase())}
                  className="mt-1 min-h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold dark:border-slate-800 dark:bg-slate-900"
                />
              </div>

              <div>
                <label htmlFor={`rubric-${idx}-label`} className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Label
                </label>
                <input
                  id={`rubric-${idx}-label`}
                  disabled={!canManage}
                  type="text"
                  value={level.label}
                  onChange={e => updateLevel(idx, "label", e.target.value)}
                  className="mt-1 min-h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-800 dark:bg-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor={`rubric-${idx}-min`} className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Min Score (%)
                  </label>
                  <input
                    id={`rubric-${idx}-min`}
                    disabled={!canManage}
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={level.minScore}
                    onChange={e => updateLevel(idx, "minScore", parseFloat(e.target.value) || 0)}
                    className="mt-1 min-h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-800 dark:bg-slate-900"
                  />
                </div>
                <div>
                  <label htmlFor={`rubric-${idx}-max`} className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Max Score (%)
                  </label>
                  <input
                    id={`rubric-${idx}-max`}
                    disabled={!canManage}
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={level.maxScore}
                    onChange={e => updateLevel(idx, "maxScore", parseFloat(e.target.value) || 0)}
                    className="mt-1 min-h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-800 dark:bg-slate-900"
                  />
                </div>
              </div>
            </div>

            <div className="mt-4">
              <label htmlFor={`rubric-${idx}-descriptor`} className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Official Competency Descriptor
              </label>
              <textarea
                id={`rubric-${idx}-descriptor`}
                disabled={!canManage}
                rows={2}
                value={level.descriptor}
                onChange={e => updateLevel(idx, "descriptor", e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm dark:border-slate-800 dark:bg-slate-900"
              />
            </div>
          </ThemedCard>
        ))}
      </div>
    </div>
  );
}
