"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  Clock,
  Plus,
  Search,
  Users,
  Sparkles,
} from "lucide-react";
import { activeSubject, gradeOptions, subjectOptions, type CurriculumCatalog } from "@/lib/curriculum";
import { Button } from "@/components/base/buttons/button";
import { Select, SelectItem } from "@/components/base/select/select";

type Assignment = { grade: string; subject: string };
type Log = {
  id: string;
  grade: string;
  subject: string;
  topics: string;
  reflection: string | null;
  status: string;
  createdAt: string;
  teacher: { name: string };
};
type DailyEntry = {
  id: string;
  grade: string;
  subject: string;
  lessonDate: string;
  status: "DONE" | "MISSED";
  notes: string | null;
  teacher: { id: string; name: string };
};

export default function TeachingLogClient({
  role,
  assignments,
  catalog,
}: {
  role: string;
  assignments: Assignment[];
  catalog?: CurriculumCatalog;
}) {
  const [logs, setLogs] = useState<Log[]>([]);
  const [dailyEntries, setDailyEntries] = useState<DailyEntry[]>([]);
  const [dailyStatuses, setDailyStatuses] = useState<Record<string, string>>({});
  const [dailyDate, setDailyDate] = useState("");
  const [dailyBusy, setDailyBusy] = useState(false);

  const availableGrades = useMemo(() => gradeOptions(assignments, catalog), [assignments, catalog]);

  const [grade, setGrade] = useState(() => availableGrades[0] ?? "");

  const subjects = useMemo(() => subjectOptions(grade, assignments, catalog), [assignments, grade, catalog]);

  const [subjectChoice, setSubjectChoice] = useState(() => subjects[0] ?? "");
  const subject = activeSubject(subjectChoice, subjects);
  const [topics, setTopics] = useState("");
  const [reflection, setReflection] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [aiBusy, setAiBusy] = useState(false);

  // Friday 4pm deadline logic
  const fridayDeadline = useMemo(() => {
    const now = new Date();
    const day = now.getDay(); // 0=Sun, 1=Mon, ... 5=Fri, 6=Sat
    const daysUntilFriday = day <= 5 ? 5 - day : 6; // next Friday
    const deadline = new Date(now);
    deadline.setDate(now.getDate() + daysUntilFriday);
    deadline.setHours(16, 0, 0, 0);
    const msLeft = deadline.getTime() - now.getTime();
    const hoursLeft = Math.max(0, Math.floor(msLeft / 3600000));
    const daysLeft = Math.floor(hoursLeft / 24);
    const isPastDeadline = msLeft < 0;
    return { daysLeft, hoursLeft: hoursLeft % 24, isPastDeadline, fridayDate: deadline };
  }, []);

  const refresh = useCallback(async () => {
    const response = await fetch("/api/teaching-logs");
    if (response.ok) {
      const data = await response.json();
      setLogs(data.logs);
    }
  }, []);

  const refreshDaily = useCallback(async () => {
    const response = await fetch("/api/teaching-logs/daily");
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "Daily lesson records could not be loaded.");
    setDailyDate(data.today);
    setDailyEntries(data.entries);
    if (role === "TEACHER") {
      const current = new Map<string, string>();
      for (const entry of data.entries as DailyEntry[]) {
        if (entry.lessonDate === data.today) current.set(`${entry.grade}::${entry.subject}`, entry.status);
      }
      setDailyStatuses(Object.fromEntries(assignments.map((item) => {
        const key = `${item.grade}::${item.subject}`;
        return [key, current.get(key) ?? ""];
      })));
    }
  }, [assignments, role]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    void refreshDaily().catch((error: unknown) => setMessage(error instanceof Error ? error.message : "Daily lesson records could not be loaded."));
  }, [refreshDaily]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/teaching-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grade, subject, topics, reflection: reflection || undefined }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setTopics("");
      setReflection("");
      setShowAdd(false);
      setMessage("Weekly teaching summary logged for leadership review.");
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Summary could not be submitted.");
    } finally {
      setBusy(false);
    }
  }

  async function saveDailyLessons(event: React.FormEvent) {
    event.preventDefault();
    if (assignments.some((item) => !dailyStatuses[`${item.grade}::${item.subject}`])) {
      setMessage("Choose Done or Missed for each assigned class and learning area.");
      return;
    }
    setDailyBusy(true);
    try {
      const response = await fetch("/api/teaching-logs/daily", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lessons: assignments.map((item) => ({
            ...item,
            status: dailyStatuses[`${item.grade}::${item.subject}`],
          })),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Daily lesson records could not be saved.");
      setMessage("Today's lesson statuses are recorded and included in the weekly log outline.");
      await refreshDaily();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Daily lesson records could not be saved.");
    } finally {
      setDailyBusy(false);
    }
  }

  function addDailyLessonsToWeeklyLog() {
    const weekStart = dailyDate ? new Date(`${dailyDate}T00:00:00.000Z`) : new Date();
    weekStart.setUTCDate(weekStart.getUTCDate() - ((weekStart.getUTCDay() + 6) % 7));
    const weekStartDate = weekStart.toISOString().slice(0, 10);
    const completed = dailyEntries
      .filter((entry) => entry.status === "DONE" && entry.lessonDate >= weekStartDate)
      .map((entry) => `${entry.lessonDate}: ${entry.grade} · ${entry.subject} — lesson completed`);
    if (!completed.length) {
      setMessage("There are no completed lessons in the recent daily logs yet.");
      return;
    }
    setTopics((current) => [current.trim(), ...completed].filter(Boolean).join("\n"));
    setMessage("Completed lessons added to the weekly summary. Review and add the topics you covered.");
  }

  async function draftWeekly() {
    setAiBusy(true);
    try {
      const response = await fetch("/api/ai/draft", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "weekly", grade, subject, topic: topics }) });
      const data = await response.json();
      if (!response.ok) { setMessage(data.error ?? "Local draft unavailable."); return; }
      setTopics(data.draft.topics);
      setReflection(data.draft.reflection);
      setMessage("AI draft added. Verify it reflects what you actually taught before submission.");
    } catch { setMessage("Could not reach the local AI service."); }
    finally { setAiBusy(false); }
  }

  async function confirm(log: Log) {
    setBusy(true);
    try {
      const response = await fetch("/api/teaching-logs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: log.id, action: "confirm" }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setMessage("Teaching log entry confirmed.");
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Confirmation failed.");
    } finally {
      setBusy(false);
    }
  }

  const filteredLogs = useMemo(() => {
    return logs.filter((l) => {
      const q = search.trim().toLowerCase();
      const matchesSearch =
        !q ||
        l.grade.toLowerCase().includes(q) ||
        l.subject.toLowerCase().includes(q) ||
        l.teacher.name.toLowerCase().includes(q) ||
        l.topics.toLowerCase().includes(q);

      const matchesStatus = statusFilter === "ALL" || l.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [logs, search, statusFilter]);

  const pendingCount = logs.filter((l) => l.status === "SUBMITTED").length;
  const confirmedCount = logs.filter((l) => l.status === "CONFIRMED").length;

  return (
    <section className="mx-auto max-w-7xl p-4 pb-28 sm:p-6 md:p-8 space-y-6">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0c1f44] via-blue-900 to-indigo-900 p-6 text-white shadow-xl sm:p-8">
        <div className="relative z-10 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-blue-400/30 bg-blue-500/20 px-3 py-1 text-xs font-semibold text-blue-200 backdrop-blur-sm">
              <ClipboardList size={13} />
              CBE Classroom Reflective Practice
            </div>
            <h1 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">
              Weekly Teaching Log
            </h1>
            <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-blue-100">
              {role === "TEACHER"
                ? "Submit your weekly teaching summary by Friday 4:00 PM. Cover strands, competencies, and reflections for each class."
                : "Inspect weekly curriculum coverage across classes and endorse educator logs."}
            </p>
            {role === "TEACHER" && (
              <div className={`mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold backdrop-blur-sm border ${
                fridayDeadline.isPastDeadline
                  ? "border-red-400/40 bg-red-500/20 text-red-200"
                  : fridayDeadline.daysLeft === 0
                  ? "border-amber-400/40 bg-amber-500/20 text-amber-200"
                  : "border-emerald-400/40 bg-emerald-500/20 text-emerald-200"
              }`}>
                <Clock size={11} />
                {fridayDeadline.isPastDeadline
                  ? "Deadline passed — submit ASAP"
                  : fridayDeadline.daysLeft === 0
                  ? `Due today (Friday 4 PM) · ${fridayDeadline.hoursLeft}h left`
                  : `Deadline: Friday 4:00 PM · ${fridayDeadline.daysLeft}d ${fridayDeadline.hoursLeft}h left`}
              </div>
            )}
          </div>

          {role === "TEACHER" && (
            <button
              onClick={() => setShowAdd(!showAdd)}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl hero-cta bg-white px-5 text-xs font-bold text-blue-950 shadow-md transition hover:bg-blue-50 active:scale-95"
            >
              <Plus size={15} />
              {showAdd ? "Close Entry" : "Log This Week's Lesson"}
            </button>
          )}
        </div>
      </div>

      {/* KPI Bento Grid */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="glass dark:glass-dark rounded-3xl border border-slate-200/80 p-5 shadow-sm dark:border-slate-800/80">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Total Log Entries
            </span>
            <div className="rounded-xl bg-blue-50 p-2 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400">
              <BookOpen size={16} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 dark:text-white">{logs.length}</span>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Recorded lessons</p>
        </div>

        <div className="glass dark:glass-dark rounded-3xl border border-slate-200/80 p-5 shadow-sm dark:border-slate-800/80">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Pending Review
            </span>
            <div className="rounded-xl bg-amber-50 p-2 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400">
              <Clock size={16} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-amber-700 dark:text-amber-400">
              {pendingCount}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Awaiting leadership check</p>
        </div>

        <div className="glass dark:glass-dark rounded-3xl border border-slate-200/80 p-5 shadow-sm dark:border-slate-800/80">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Confirmed
            </span>
            <div className="rounded-xl bg-emerald-50 p-2 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400">
              <CheckCircle2 size={16} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-700 dark:text-emerald-400">
              {confirmedCount}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Approved curriculum logs</p>
        </div>

        <div className="glass dark:glass-dark rounded-3xl border border-slate-200/80 p-5 shadow-sm dark:border-slate-800/80">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Assigned Classes
            </span>
            <div className="rounded-xl bg-purple-50 p-2 text-purple-700 dark:bg-purple-950/60 dark:text-purple-400">
              <Users size={16} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-purple-700 dark:text-purple-400">
              {assignments.length}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Grade &amp; subject pairs</p>
        </div>
      </div>

      {message && (
        <div
          role="status"
          className="flex items-center gap-2 rounded-2xl border border-blue-200 bg-blue-50/90 p-4 text-xs font-semibold text-blue-900 shadow-sm dark:border-blue-900/60 dark:bg-blue-950/50 dark:text-blue-300"
        >
          <AlertCircle size={16} className="shrink-0" />
          <span>{message}</span>
        </div>
      )}

      {role === "TEACHER" && (
        <form onSubmit={saveDailyLessons} className="rounded-3xl border border-border-button-default bg-background-primary-default p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-title-3-semibold text-text-primary">Today&apos;s lesson check-in</h2>
              <p className="mt-1 text-body-2-regular text-text-secondary">
                {dailyDate ? new Intl.DateTimeFormat("en-KE", { dateStyle: "full", timeZone: "Africa/Nairobi" }).format(new Date(`${dailyDate}T12:00:00+03:00`)) : "Loading today’s date…"}
                {" · "}Mark each assigned class as Done or Missed.
              </p>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="small"
              disabled={!assignments.length}
              onClick={() => setDailyStatuses(Object.fromEntries(assignments.map((item) => [`${item.grade}::${item.subject}`, "DONE"])))}
            >
              Mark all done
            </Button>
          </div>
          {assignments.length === 0 ? (
            <p className="mt-4 rounded-xl bg-background-secondary-default p-4 text-body-2-regular text-text-secondary">No classes are assigned to your account yet.</p>
          ) : (
            <>
              <ul className="mt-4 divide-y divide-separator-border">
                {assignments.map((item) => {
                  const key = `${item.grade}::${item.subject}`;
                  return (
                    <li key={key} className="grid gap-3 py-3 sm:grid-cols-[1fr_auto] sm:items-center">
                      <p className="text-body-medium text-text-primary">{item.grade} · {item.subject}</p>
                      <Select
                        aria-label={`Lesson status for ${item.grade} ${item.subject}`}
                        placeholder="Choose status"
                        selectedKey={dailyStatuses[key] || null}
                        onSelectionChange={(selection) => setDailyStatuses((current) => ({ ...current, [key]: String(selection ?? "") }))}
                        className="w-full sm:w-48"
                      >
                        <SelectItem id="DONE">Done</SelectItem>
                        <SelectItem id="MISSED">Missed</SelectItem>
                      </Select>
                    </li>
                  );
                })}
              </ul>
              <div className="mt-4 flex justify-end border-t border-separator-border pt-4">
                <Button type="submit" disabled={dailyBusy || !assignments.every((item) => dailyStatuses[`${item.grade}::${item.subject}`])}>
                  {dailyBusy ? "Saving…" : "Save today’s lessons"}
                </Button>
              </div>
            </>
          )}
        </form>
      )}

      {role !== "TEACHER" && dailyEntries.length > 0 && (
        <section className="rounded-3xl border border-border-button-default bg-background-primary-default p-5">
          <h2 className="text-title-3-semibold text-text-primary">Daily lesson check-ins</h2>
          <ul className="mt-3 divide-y divide-separator-border">
            {dailyEntries.slice(0, 20).map((entry) => (
              <li key={entry.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <span className="text-body-regular text-text-primary">{entry.teacher.name} · {entry.grade} · {entry.subject}</span>
                <span className={`rounded-full px-3 py-1 text-caption-1-semibold ${entry.status === "DONE" ? "bg-background-secondary-default text-text-secondary" : "bg-background-secondary-default text-text-error-primary"}`}>
                  {entry.status === "DONE" ? "Done" : "Missed"} · {entry.lessonDate}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Log Form (Bento Expandable for Teachers) */}
      {role === "TEACHER" && showAdd && (
        <form
          onSubmit={submit}
          className="glass dark:glass-dark rounded-3xl border border-blue-200/70 p-6 shadow-md transition-all sm:p-7 dark:border-blue-900/60"
        >
          <div className="mb-5 flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-600 text-white shadow-sm">
              <Plus size={18} />
            </span>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Log This Week&apos;s Classroom Instruction
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Weekly summary of strands and learning achievements — due Friday 4:00 PM.
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Class / Grade <span className="text-blue-600">*</span>
              </label>
              <select
                required
                value={grade}
                onChange={(e) => {
                  const newGrade = e.target.value;
                  setGrade(newGrade);
                  setSubjectChoice(subjectOptions(newGrade, assignments, catalog)[0] ?? "");
                }}
                className="mt-1.5 min-h-11 w-full rounded-2xl border border-slate-200 bg-white/70 px-3 text-xs font-medium text-slate-900 outline-none focus:border-blue-600 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              >
                {availableGrades.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Subject / Learning Area <span className="text-blue-600">*</span>
              </label>
              <select
                required
                value={subject}
                onChange={(e) => setSubjectChoice(e.target.value)}
                className="mt-1.5 min-h-11 w-full rounded-2xl border border-slate-200 bg-white/70 px-3 text-xs font-medium text-slate-900 outline-none focus:border-blue-600 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              >
                {subjects.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Topics &amp; Competencies Covered <span className="text-blue-600">*</span>
              </label>
              <Button type="button" variant="secondary" size="small" className="mb-2 mt-1" onClick={addDailyLessonsToWeeklyLog}>
                Add completed lessons from this week
              </Button>
              <textarea
                required
                minLength={5}
                maxLength={1200}
                rows={4}
                value={topics}
                onChange={(e) => setTopics(e.target.value)}
                placeholder="Detail the sub-strands, student activities, or practical assignments conducted…"
                className="mt-1.5 w-full rounded-2xl border border-slate-200 bg-white/70 p-4 text-xs font-medium text-slate-900 outline-none focus:border-blue-600 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              />
              <button type="button" onClick={() => void draftWeekly()} disabled={aiBusy || topics.trim().length < 2} className="mt-2 inline-flex min-h-10 items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 text-xs font-bold text-blue-800 disabled:opacity-50 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-300"><Sparkles size={14}/>{aiBusy ? "Drafting locally…" : "Help draft with local AI"}</button>
            </div>

            <div className="sm:col-span-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Reflection &amp; Resource Needs (Optional)
              </label>
              <textarea
                maxLength={600}
                rows={2}
                value={reflection}
                onChange={(e) => setReflection(e.target.value)}
                placeholder="Any learner difficulties, support requests, or follow-up notes for the Head Teacher?"
                className="mt-1.5 w-full rounded-2xl border border-slate-200 bg-white/70 p-4 text-xs font-medium text-slate-900 outline-none focus:border-blue-600 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setShowAdd(false)}
              className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              disabled={busy || !grade || !subject}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-700 px-6 text-xs font-bold text-white shadow-md shadow-blue-700/20 transition hover:bg-blue-800 disabled:opacity-50"
            >
              <CheckCircle2 size={15} />
              {busy ? "Submitting…" : "              Submit Weekly Summary"}
            </button>
          </div>
        </form>
      )}

      {/* Log Feed Section */}
      <section className="glass dark:glass-dark rounded-3xl border border-slate-200/80 p-6 shadow-sm dark:border-slate-800/80">
        <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
          <div>
            <h2 className="text-lg font-black tracking-tight text-slate-900 dark:text-white">
              Teaching Log Archive
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              End-of-day reports submitted across classes.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-48 sm:w-64">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500"
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search teacher, class, topic…"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50/70 py-1.5 pl-8 pr-3 text-xs font-medium text-slate-900 outline-none focus:border-blue-600 focus:bg-white dark:border-slate-700 dark:bg-slate-900/60 dark:text-white"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-2xl border border-slate-200 bg-slate-50/70 px-3 py-1.5 text-xs font-bold text-slate-700 outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
            >
              <option value="ALL">All Logs</option>
              <option value="SUBMITTED">Pending Confirmation</option>
              <option value="CONFIRMED">Confirmed</option>
            </select>
          </div>
        </div>

        <div className="mt-6 space-y-4">
          {filteredLogs.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 p-12 text-center dark:border-slate-800">
              <ClipboardList className="mx-auto text-blue-500" size={32} />
              <p className="mt-3 text-sm font-bold text-slate-900 dark:text-white">
                No teaching logs found
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {role === "TEACHER"
                  ? "Submit your first daily log above."
                  : "Daily teaching summaries will appear here as teachers log lessons."}
              </p>
            </div>
          ) : (
            filteredLogs.map((log) => {
              const isConfirmed = log.status === "CONFIRMED";
              return (
                <article
                  key={log.id}
                  className="rounded-2xl border border-slate-200/80 bg-white/70 p-5 shadow-sm transition-all hover:border-blue-200 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/50"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[10px] font-bold text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                          {log.grade} · {log.subject}
                        </span>
                        <span className="text-xs text-slate-400">•</span>
                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                          {log.teacher.name}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {new Intl.DateTimeFormat("en-KE", {
                          dateStyle: "medium",
                          timeStyle: "short",
                          timeZone: "Africa/Nairobi",
                        }).format(new Date(log.createdAt))}
                      </p>
                    </div>

                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                        isConfirmed
                          ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                          : "bg-amber-50 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300"
                      }`}
                    >
                      {isConfirmed ? <CheckCircle2 size={11} /> : <Clock size={11} />}
                      {log.status}
                    </span>
                  </div>

                  <p className="mt-3 text-xs leading-relaxed text-slate-800 whitespace-pre-wrap dark:text-slate-200">
                    {log.topics}
                  </p>

                  {log.reflection && (
                    <div className="mt-3 rounded-2xl bg-slate-50/70 p-3 text-xs text-slate-600 dark:bg-slate-950/40 dark:text-slate-400">
                      <strong>Educator Reflection:</strong> {log.reflection}
                    </div>
                  )}

                  {role !== "TEACHER" && log.status === "SUBMITTED" && (
                    <div className="mt-4 flex justify-end border-t border-slate-100 pt-3 dark:border-slate-800">
                      <button
                        disabled={busy}
                        onClick={() => void confirm(log)}
                        className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-blue-700 px-4 text-xs font-bold text-white shadow-sm transition hover:bg-blue-800 disabled:opacity-50"
                      >
                        <CheckCircle2 size={13} />
                        Confirm &amp; Endorse Log
                      </button>
                    </div>
                  )}
                </article>
              );
            })
          )}
        </div>
      </section>
    </section>
  );
}
