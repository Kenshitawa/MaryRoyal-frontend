"use client";

import { useCallback, useEffect, useState } from "react";
import { LearnerLink } from "@/components/learner-link";
import { Check, Save } from "lucide-react";

type Row = {
  id: string;
  name: string;
  admissionNo: string;
  status: "PRESENT" | "ABSENT" | "LATE";
};

const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Nairobi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

export default function AttendanceClient({ grades }: { grades: string[] }) {
  const [grade, setGrade] = useState(grades[0] ?? "");
  const [date, setDate] = useState(today());
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    if (!grade) return;
    setBusy(true);
    try {
      const response = await fetch(
        `/api/attendance?grade=${encodeURIComponent(grade)}&date=${date}`
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setRows(data.learners);
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Attendance failed to load.");
    } finally {
      setBusy(false);
    }
  }, [grade, date]);

  useEffect(() => {
    void load();
  }, [load]);

  function setStatus(id: string, status: Row["status"]) {
    setRows((old) => old.map((row) => (row.id === id ? { ...row, status } : row)));
  }

  function markAll(status: Row["status"]) {
    setRows((old) => old.map((row) => ({ ...row, status })));
  }

  async function save() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grade,
          date,
          records: rows.map(({ id, status }) => ({ learnerId: id, status })),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setMessage(`Daily attendance successfully logged for ${data.saved} learners.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Attendance could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  // Current counts
  const presentCount = rows.filter((r) => r.status === "PRESENT").length;
  const absentCount = rows.filter((r) => r.status === "ABSENT").length;
  const lateCount = rows.filter((r) => r.status === "LATE").length;

  return (
    <section className="glass dark:glass-dark rounded-3xl border border-slate-200/80 p-6 shadow-sm sm:p-7 dark:border-slate-800/80">
      <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
        <div>
          <h2 className="text-xl font-black tracking-tight text-slate-900 dark:text-white">
            Daily Classroom Roll Call
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Select a class and date to take attendance. Changes are audited.
          </p>
        </div>

        {/* Action quick shortcut */}
        {rows.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => markAll("PRESENT")}
              className="inline-flex items-center gap-1 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800 transition hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
            >
              <Check size={12} />
              Mark All Present
            </button>
          </div>
        )}
      </div>

      {/* Class & Date Selector */}
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <label htmlFor="attendance-grade" className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Class / Grade
          </label>
          <select
            id="attendance-grade"
            value={grade}
            onChange={(e) => setGrade(e.target.value)}
            className="mt-1.5 min-h-11 w-full rounded-2xl border border-slate-200 bg-white/70 px-4 text-xs font-bold text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
          >
            {grades.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="attendance-date" className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Attendance Date
          </label>
          <input
            id="attendance-date"
            type="date"
            value={date}
            max={today()}
            onChange={(e) => setDate(e.target.value)}
            className="mt-1.5 min-h-11 w-full rounded-2xl border border-slate-200 bg-white/70 px-4 text-xs font-bold text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
          />
        </div>

        {/* Live Counters */}
        <div className="flex items-end">
          <div className="flex h-11 w-full items-center justify-around rounded-2xl border border-slate-200/80 bg-slate-50/60 px-3 text-xs font-bold dark:border-slate-800 dark:bg-slate-900/60">
            <span className="text-emerald-700 dark:text-emerald-400">
              {presentCount} Present
            </span>
            <span className="text-slate-300 dark:text-slate-700">|</span>
            <span className="text-amber-700 dark:text-amber-400">{lateCount} Late</span>
            <span className="text-slate-300 dark:text-slate-700">|</span>
            <span className="text-red-700 dark:text-red-400">{absentCount} Absent</span>
          </div>
        </div>
      </div>

      {message && (
        <div
          role="status"
          className="mt-5 rounded-2xl border border-blue-200 bg-blue-50/80 p-3.5 text-xs font-semibold text-blue-900 shadow-sm dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300"
        >
          {message}
        </div>
      )}

      {/* Learners Roll Call List */}
      <div className="mt-6">
        {rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 p-12 text-center text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
            {busy ? "Loading class roster…" : "No learners found for this class."}
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white/70 dark:border-slate-800 dark:bg-slate-900/50">
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {rows.map((row, index) => {
                const isPresent = row.status === "PRESENT";
                const isAbsent = row.status === "ABSENT";
                const isLate = row.status === "LATE";

                return (
                  <article
                    key={row.id}
                    className="flex flex-col gap-3 p-3.5 transition-colors sm:flex-row sm:items-center sm:justify-between sm:p-4 hover:bg-slate-50/50 dark:hover:bg-slate-900/40"
                  >
                    <div className="flex items-center gap-3">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-slate-100 font-mono text-xs font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                        {index + 1}
                      </span>
                      <div>
                        <LearnerLink
                          id={row.id}
                          name={row.name}
                          admissionNo={row.admissionNo}
                          className="font-bold text-slate-900 dark:text-white"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-1 rounded-2xl border border-slate-200/80 bg-slate-100/70 p-1 self-end sm:self-auto dark:border-slate-800 dark:bg-slate-950/60">
                      <button
                        type="button"
                        aria-pressed={isPresent}
                        onClick={() => setStatus(row.id, "PRESENT")}
                        className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                          isPresent
                            ? "bg-emerald-600 text-white shadow-sm"
                            : "text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
                        }`}
                      >
                        Present
                      </button>

                      <button
                        type="button"
                        aria-pressed={isLate}
                        onClick={() => setStatus(row.id, "LATE")}
                        className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                          isLate
                            ? "bg-amber-500 text-white shadow-sm"
                            : "text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
                        }`}
                      >
                        Late
                      </button>

                      <button
                        type="button"
                        aria-pressed={isAbsent}
                        onClick={() => setStatus(row.id, "ABSENT")}
                        className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                          isAbsent
                            ? "bg-red-600 text-white shadow-sm"
                            : "text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
                        }`}
                      >
                        Absent
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>

            {/* Sticky Save Bar */}
            <div className="sticky bottom-0 flex items-center justify-between border-t border-slate-100 bg-white/95 p-4 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/95">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {rows.length} learners enrolled · Ready to commit
              </span>
              <button
                disabled={busy || rows.length === 0}
                onClick={() => void save()}
                className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-700 to-indigo-700 px-6 text-xs font-bold text-white shadow-md shadow-blue-700/20 transition hover:brightness-110 disabled:opacity-50"
              >
                <Save size={15} />
                {busy ? "Saving Register…" : "Commit Attendance"}
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
