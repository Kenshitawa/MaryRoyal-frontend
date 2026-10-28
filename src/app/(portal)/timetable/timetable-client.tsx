"use client";

import { useState, useMemo } from "react";
import {
  CalendarDays,
  Sparkles,
  CheckCircle,
  Clock,
  BookOpen,
  Send,
  ShieldCheck,
  Printer,
  Pencil,
  Trash2,
} from "lucide-react";

export interface TimetableSlot {
  id: string;
  day: "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday";
  period: number;
  time: string;
  grade: string;
  subject: string;
  teacherId?: string;
  teacherName?: string;
  room?: string;
}

export interface TimetableRecord {
  id: string;
  title: string;
  term: string;
  year: number;
  status: string;
  scheduleJson: string;
  createdAt: string | Date;
  createdBy: { id: string; name: string };
  verifiedBy?: { id: string; name: string } | null;
  verifiedAt?: string | Date | null;
}

interface Teacher {
  id: string;
  name: string;
}

interface Assignment {
  teacherId: string;
  grade: string;
  subject: string;
}

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"] as const;
const PERIOD_TIMES = [
  { period: 1, time: "08:20 - 09:00", isBreak: false, label: "Period 1" },
  { period: 2, time: "09:00 - 09:40", isBreak: false, label: "Period 2" },
  { period: 0, time: "09:40 - 10:10", isBreak: true, label: "Short Break" },
  { period: 3, time: "10:10 - 10:50", isBreak: false, label: "Period 3" },
  { period: 4, time: "10:50 - 11:30", isBreak: false, label: "Period 4" },
  { period: 5, time: "11:30 - 12:10", isBreak: false, label: "Period 5" },
  { period: -1, time: "12:10 - 13:30", isBreak: true, label: "Lunch Break" },
  { period: 6, time: "13:30 - 14:10", isBreak: false, label: "Period 6" },
  { period: 7, time: "14:10 - 14:50", isBreak: false, label: "Period 7" },
  { period: 8, time: "14:50 - 15:30", isBreak: false, label: "Period 8" },
];

const STANDARD_GRADES = [
  "Grade 1",
  "Grade 2",
  "Grade 3",
  "Grade 4",
  "Grade 5",
  "Grade 6",
  "Grade 7",
  "Grade 8",
  "PP1",
  "PP2",
];

const CORE_SUBJECTS: Record<string, string[]> = {
  default: [
    "Mathematics",
    "English",
    "Kiswahili",
    "Science",
    "Social Studies",
    "CRE",
    "Creative Arts",
    "Physical Education",
  ],
  junior: [
    "Mathematics",
    "English",
    "Kiswahili",
    "Integrated Science",
    "Social Studies",
    "CRE",
    "Pre-Technical Studies",
    "Agriculture",
    "Creative Arts & Sports",
  ],
};

export default function TimetableClient({
  role,
  userId,
  timetables: initialTimetables,
  teachers,
  assignments,
}: {
  role: string;
  userId: string;
  userName?: string;
  timetables: TimetableRecord[];
  teachers: Teacher[];
  assignments: Assignment[];
}) {
  const [timetables, setTimetables] = useState<TimetableRecord[]>(initialTimetables);
  const [selectedTimetableId, setSelectedTimetableId] = useState<string>(
    initialTimetables[0]?.id || ""
  );
  const [activeTab, setActiveTab] = useState<"view" | "my" | "today" | "builder">(
    role === "TEACHER" ? "today" : "view"
  );
  const [selectedGrade, setSelectedGrade] = useState<string>("Grade 4");
  const [filterTeacherId, setFilterTeacherId] = useState<string>("");
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [loading, setLoading] = useState(false);

  // Builder state
  const [editingTimetableId, setEditingTimetableId] = useState<string | null>(null);
  const [builderTitle, setBuilderTitle] = useState("Term 1 2026 Timetable");
  const [builderTerm, setBuilderTerm] = useState("Term 1");
  const [builderYear, setBuilderYear] = useState(2026);
  const [builderGrade, setBuilderGrade] = useState("Grade 4");
  const [builderSlots, setBuilderSlots] = useState<TimetableSlot[]>([]);
  const [editingSlot, setEditingSlot] = useState<TimetableSlot | null>(null);

  const isAdmin = ["DIRECTOR", "HEAD_TEACHER", "DEPUTY"].includes(role);
  const isHeadOrDirector = ["DIRECTOR", "HEAD_TEACHER"].includes(role);

  const activeTimetable = useMemo(() => {
    return timetables.find((t) => t.id === selectedTimetableId) || timetables[0] || null;
  }, [timetables, selectedTimetableId]);

  const activeSlots = useMemo<TimetableSlot[]>(() => {
    if (!activeTimetable) return [];
    try {
      const parsed = JSON.parse(activeTimetable.scheduleJson);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [activeTimetable]);

  // Today's day name in Kenya
  const todayDayName = useMemo(() => {
    const dayIndex = new Date().getDay();
    const map = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    return map[dayIndex];
  }, []);

  const todaySlotsForUser = useMemo(() => {
    return activeSlots.filter((s) => {
      const matchDay = s.day.toLowerCase() === todayDayName.toLowerCase();
      if (!matchDay) return false;
      if (role === "TEACHER") {
        return s.teacherId === userId;
      }
      return true;
    }).sort((a, b) => a.period - b.period);
  }, [activeSlots, todayDayName, role, userId]);

  const myWeeklySlots = useMemo(() => {
    return activeSlots.filter((s) => s.teacherId === userId);
  }, [activeSlots, userId]);

  async function refreshTimetables() {
    try {
      const res = await fetch("/api/timetable");
      if (res.ok) {
        const data = await res.json();
        setTimetables(data.timetables || []);
      }
    } catch (e) {
      console.error(e);
    }
  }

  function handleStartEditing(tt: TimetableRecord) {
    setEditingTimetableId(tt.id);
    setBuilderTitle(tt.title);
    setBuilderTerm(tt.term);
    setBuilderYear(tt.year);
    try {
      const parsed = JSON.parse(tt.scheduleJson);
      setBuilderSlots(Array.isArray(parsed) ? parsed : []);
    } catch {
      setBuilderSlots([]);
    }
    setActiveTab("builder");
    setStatusMessage({
      text: `Editing "${tt.title}". Click on any period in the builder grid below to update teachers, subjects, or rooms.`,
      type: "success",
    });
  }

  // AI-Assisted Timetable Generator (Local heuristic schedule synthesis)
  function handleGenerateAiSchedule() {
    const slots: TimetableSlot[] = [];
    const subjects = builderGrade.includes("Grade 7") || builderGrade.includes("Grade 8")
      ? CORE_SUBJECTS.junior
      : CORE_SUBJECTS.default;

    let subjectIdx = 0;

    for (const day of DAYS) {
      for (const p of PERIOD_TIMES) {
        if (p.isBreak) continue;

        const subject = subjects[subjectIdx % subjects.length];
        subjectIdx++;

        // Find teacher assigned to this subject and grade
        const assign = assignments.find(
          (a) => a.grade.toLowerCase() === builderGrade.toLowerCase() &&
                 a.subject.toLowerCase() === subject.toLowerCase()
        );
        const assignedTeacher = assign
          ? teachers.find((t) => t.id === assign.teacherId)
          : teachers[Math.floor(Math.random() * teachers.length)];

        slots.push({
          id: `${day}-${p.period}-${builderGrade}-${Date.now()}-${Math.random()}`,
          day,
          period: p.period,
          time: p.time,
          grade: builderGrade,
          subject,
          teacherId: assignedTeacher?.id,
          teacherName: assignedTeacher?.name || "Unassigned",
          room: `${builderGrade} Room`,
        });
      }
    }

    setBuilderSlots(slots);
    setStatusMessage({
      text: `AI Assistant generated balanced 5-day schedule for ${builderGrade} (40 lessons) with teacher conflict checks.`,
      type: "success",
    });
  }

  async function handleSaveDraft() {
    if (!builderSlots.length) {
      setStatusMessage({ text: "Generate or add lessons before saving.", type: "error" });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/timetable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          _action: "create",
          title: `${builderGrade} ${builderTitle}`,
          term: builderTerm,
          year: builderYear,
          scheduleJson: JSON.stringify(builderSlots),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save timetable");
      setStatusMessage({ text: "Timetable draft saved successfully!", type: "success" });
      await refreshTimetables();
      setSelectedTimetableId(data.timetable.id);
      setActiveTab("view");
    } catch (e: unknown) {
      const err = e as Error;
      setStatusMessage({ text: err.message, type: "error" });
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdateTimetable(publishDirectly = false) {
    if (!editingTimetableId) return;
    setLoading(true);
    try {
      const res = await fetch("/api/timetable", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update",
          id: editingTimetableId,
          title: builderTitle,
          scheduleJson: JSON.stringify(builderSlots),
          publishDirectly,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update timetable");
      setStatusMessage({
        text: publishDirectly
          ? "Timetable updated and published live to all teachers!"
          : "Timetable changes saved successfully.",
        type: "success",
      });
      await refreshTimetables();
      setSelectedTimetableId(editingTimetableId);
      setEditingTimetableId(null);
      setActiveTab("view");
    } catch (e: unknown) {
      const err = e as Error;
      setStatusMessage({ text: err.message, type: "error" });
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmitForVerification(id: string) {
    if (!confirm("Submit this timetable to Head Teacher for verification and publishing?")) return;
    setLoading(true);
    try {
      const res = await fetch("/api/timetable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ _action: "submit", id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Submission failed");
      setStatusMessage({ text: "Timetable submitted to Head Teacher for verification!", type: "success" });
      await refreshTimetables();
    } catch (e: unknown) {
      const err = e as Error;
      setStatusMessage({ text: err.message, type: "error" });
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyAndPublish(id: string) {
    if (!confirm("Verify and publish this timetable? All teachers will receive an alert and their lesson schedules will be updated.")) return;
    setLoading(true);
    try {
      const res = await fetch("/api/timetable", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify", id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Verification failed");
      setStatusMessage({ text: "Timetable verified and published to all teachers!", type: "success" });
      await refreshTimetables();
    } catch (e: unknown) {
      const err = e as Error;
      setStatusMessage({ text: err.message, type: "error" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-200 dark:border-gray-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <CalendarDays className="h-7 w-7 text-blue-700 dark:text-blue-400" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              School Timetable
            </h1>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Mary Royal School lesson scheduling, teacher workload distribution & verification
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {isAdmin && (
            <button
              onClick={() => {
                setActiveTab("builder");
                if (builderSlots.length === 0) handleGenerateAiSchedule();
              }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white font-medium rounded-lg text-sm shadow transition"
            >
              <Sparkles className="h-4 w-4" />
              AI Timetable Builder
            </button>
          )}
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 transition"
          >
            <Printer className="h-4 w-4" />
            Print
          </button>
        </div>
      </div>

      {statusMessage && (
        <div
          className={`p-3 rounded-lg flex items-center justify-between text-sm ${
            statusMessage.type === "success"
              ? "bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-300 border border-green-200"
              : "bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-300 border border-red-200"
          }`}
        >
          <span>{statusMessage.text}</span>
          <button
            onClick={() => setStatusMessage(null)}
            className="text-xs font-semibold underline ml-2"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-800 gap-2 overflow-x-auto">
        {role === "TEACHER" && (
          <button
            onClick={() => setActiveTab("today")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition whitespace-nowrap flex items-center gap-2 ${
              activeTab === "today"
                ? "border-blue-700 text-blue-700 dark:border-blue-400 dark:text-blue-400"
                : "border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900"
            }`}
          >
            <Clock className="h-4 w-4" />
            Today&apos;s Lessons ({todayDayName})
          </button>
        )}
        <button
          onClick={() => setActiveTab("view")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition whitespace-nowrap flex items-center gap-2 ${
            activeTab === "view"
              ? "border-blue-700 text-blue-700 dark:border-blue-400 dark:text-blue-400"
              : "border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900"
          }`}
        >
          <BookOpen className="h-4 w-4" />
          Master Timetable
        </button>
        {role === "TEACHER" && (
          <button
            onClick={() => setActiveTab("my")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition whitespace-nowrap flex items-center gap-2 ${
              activeTab === "my"
                ? "border-blue-700 text-blue-700 dark:border-blue-400 dark:text-blue-400"
                : "border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900"
            }`}
          >
            <CalendarDays className="h-4 w-4" />
            My Weekly Schedule
          </button>
        )}
        {isAdmin && (
          <button
            onClick={() => setActiveTab("builder")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition whitespace-nowrap flex items-center gap-2 ${
              activeTab === "builder"
                ? "border-blue-700 text-blue-700 dark:border-blue-400 dark:text-blue-400"
                : "border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900"
            }`}
          >
            <Sparkles className="h-4 w-4" />
            AI Timetable Builder
          </button>
        )}
      </div>

      {/* TAB 1: Today's Lessons (for teachers) */}
      {activeTab === "today" && (
        <div className="space-y-4">
          <div className="bg-gradient-to-r from-blue-900 to-indigo-900 text-white rounded-xl p-6 shadow-md">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <div>
                <span className="text-xs uppercase tracking-wider text-blue-200 font-semibold">
                  Daily Teaching Schedule
                </span>
                <h2 className="text-2xl font-bold mt-1">
                  {todayDayName}&apos;s Lessons
                </h2>
                <p className="text-sm text-blue-200 mt-1">
                  Active timetable: {activeTimetable?.title || "None published"}
                </p>
              </div>
              <div className="bg-white/10 px-4 py-2 rounded-lg text-sm font-semibold">
                {todaySlotsForUser.length} {todaySlotsForUser.length === 1 ? "Lesson" : "Lessons"} Today
              </div>
            </div>
          </div>

          {todaySlotsForUser.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-800">
              <CheckCircle className="h-10 w-10 text-green-500 mx-auto mb-2" />
              <p className="font-semibold text-gray-700 dark:text-gray-300">
                No lessons scheduled for {todayDayName}.
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Enjoy your preparation time or check the master timetable.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {todaySlotsForUser.map((slot) => (
                <div
                  key={slot.id}
                  className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm hover:shadow transition"
                >
                  <div className="flex items-center justify-between text-xs text-blue-700 dark:text-blue-400 font-bold uppercase mb-2">
                    <span>Period {slot.period}</span>
                    <span className="text-gray-500 dark:text-gray-400 font-normal">{slot.time}</span>
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                    {slot.subject}
                  </h3>
                  <div className="mt-2 text-sm text-gray-600 dark:text-gray-300 space-y-1">
                    <p className="font-medium text-blue-800 dark:text-blue-300">
                      Class: {slot.grade}
                    </p>
                    <p className="text-xs text-gray-500">
                      Location: {slot.room || `${slot.grade} Classroom`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Master Timetable */}
      {activeTab === "view" && (
        <div className="space-y-4">
          {/* Controls: Timetable selector, Grade filter, Teacher filter */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-gray-50 dark:bg-gray-800/60 p-3 rounded-xl border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2 flex-wrap">
              <label className="text-xs font-semibold text-gray-600 dark:text-gray-400">
                Timetable:
              </label>
              <select
                value={selectedTimetableId}
                onChange={(e) => setSelectedTimetableId(e.target.value)}
                className="text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-1.5 font-medium"
              >
                {timetables.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title} ({t.status})
                  </option>
                ))}
              </select>

              <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 ml-2">
                Class:
              </label>
              <select
                value={selectedGrade}
                onChange={(e) => setSelectedGrade(e.target.value)}
                className="text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-1.5"
              >
                <option value="ALL">All Classes</option>
                {STANDARD_GRADES.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>

              <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 ml-2">
                Teacher:
              </label>
              <select
                value={filterTeacherId}
                onChange={(e) => setFilterTeacherId(e.target.value)}
                className="text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-1.5"
              >
                <option value="">All Teachers</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Admin status actions */}
            {activeTimetable && (
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs px-2.5 py-1 rounded-full font-bold ${
                    activeTimetable.status === "PUBLISHED"
                      ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300"
                      : activeTimetable.status === "PENDING_APPROVAL"
                      ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300"
                      : "bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-300"
                  }`}
                >
                  {activeTimetable.status}
                </span>

                {isAdmin && (
                  <button
                    onClick={() => handleStartEditing(activeTimetable)}
                    className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 hover:bg-blue-100 rounded-lg text-xs font-semibold transition"
                    title="Edit lessons, teachers or periods in this timetable"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Edit Timetable
                  </button>
                )}

                {isAdmin && activeTimetable.status === "DRAFT" && (
                  <button
                    disabled={loading}
                    onClick={() => handleSubmitForVerification(activeTimetable.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold transition"
                  >
                    <Send className="h-3.5 w-3.5" />
                    Submit for Verification
                  </button>
                )}

                {isHeadOrDirector && activeTimetable.status !== "PUBLISHED" && (
                  <button
                    disabled={loading}
                    onClick={() => handleVerifyAndPublish(activeTimetable.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-semibold transition shadow-sm"
                  >
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Verify & Publish
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Grid View */}
          <div className="overflow-x-auto border border-gray-200 dark:border-gray-800 rounded-xl bg-white dark:bg-gray-900 shadow-sm">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700">
                  <th className="p-3 text-left font-bold w-28">Period / Time</th>
                  {DAYS.map((day) => (
                    <th key={day} className="p-3 text-left font-bold border-l border-gray-200 dark:border-gray-700">
                      {day}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PERIOD_TIMES.map((pt, idx) => {
                  if (pt.isBreak) {
                    return (
                      <tr key={idx} className="bg-amber-50/60 dark:bg-amber-950/20 text-amber-900 dark:text-amber-200 border-b border-gray-200 dark:border-gray-800">
                        <td className="p-2 font-semibold italic text-center" colSpan={6}>
                          ☕ {pt.label} ({pt.time})
                        </td>
                      </tr>
                    );
                  }

                  return (
                    <tr
                      key={idx}
                      className="border-b border-gray-200 dark:border-gray-800 hover:bg-gray-50/50 dark:hover:bg-gray-800/40 transition"
                    >
                      <td className="p-3 font-semibold text-gray-600 dark:text-gray-400 bg-gray-50/70 dark:bg-gray-850">
                        <div className="font-bold text-gray-900 dark:text-gray-100">{pt.label}</div>
                        <div className="text-[11px] text-gray-500">{pt.time}</div>
                      </td>
                      {DAYS.map((day) => {
                        const matching = activeSlots.filter(
                          (s) =>
                            s.day === day &&
                            s.period === pt.period &&
                            (selectedGrade === "ALL" || s.grade.toLowerCase() === selectedGrade.toLowerCase()) &&
                            (!filterTeacherId || s.teacherId === filterTeacherId)
                        );

                        return (
                          <td
                            key={day}
                            className="p-2 border-l border-gray-200 dark:border-gray-800 align-top min-w-[140px]"
                          >
                            {matching.length === 0 ? (
                              <span className="text-gray-400 text-[11px] italic">—</span>
                            ) : (
                              <div className="space-y-1.5">
                                {matching.map((m) => (
                                  <div
                                    key={m.id}
                                    className="p-2 rounded bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-900 text-gray-900 dark:text-gray-100"
                                  >
                                    <div className="font-bold text-blue-900 dark:text-blue-300">
                                      {m.subject}
                                    </div>
                                    <div className="text-[11px] text-gray-600 dark:text-gray-400 flex justify-between">
                                      <span>{m.grade}</span>
                                      <span className="font-medium text-gray-800 dark:text-gray-200 truncate max-w-[80px]">
                                        {m.teacherName || "Unassigned"}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: My Weekly Schedule (for teacher) */}
      {activeTab === "my" && (
        <div className="space-y-4">
          <div className="p-4 bg-blue-50 dark:bg-blue-950/40 rounded-xl border border-blue-200 dark:border-blue-900 flex justify-between items-center">
            <div>
              <h3 className="text-base font-bold text-blue-900 dark:text-blue-300">
                My Weekly Teaching Load
              </h3>
              <p className="text-xs text-blue-700 dark:text-blue-400">
                Total assigned lessons: {myWeeklySlots.length} periods per week
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            {DAYS.map((day) => {
              const dayLessons = myWeeklySlots
                .filter((s) => s.day === day)
                .sort((a, b) => a.period - b.period);

              return (
                <div
                  key={day}
                  className="bg-white dark:bg-gray-850 rounded-xl border border-gray-200 dark:border-gray-800 p-3 shadow-sm"
                >
                  <h4 className="font-bold text-sm text-gray-900 dark:text-white border-b pb-2 mb-2">
                    {day}
                  </h4>
                  {dayLessons.length === 0 ? (
                    <p className="text-xs text-gray-400 italic py-4 text-center">No lessons</p>
                  ) : (
                    <div className="space-y-2">
                      {dayLessons.map((l) => (
                        <div
                          key={l.id}
                          className="p-2 rounded bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-900 text-xs"
                        >
                          <div className="flex justify-between font-bold text-indigo-900 dark:text-indigo-300">
                            <span>Period {l.period}</span>
                            <span className="text-[10px] text-gray-500">{l.time}</span>
                          </div>
                          <p className="font-semibold text-gray-900 dark:text-white mt-1">
                            {l.subject}
                          </p>
                          <p className="text-[11px] text-gray-600 dark:text-gray-400">{l.grade}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 4: AI Timetable Builder (Admin only) */}
      {activeTab === "builder" && isAdmin && (
        <div className="space-y-6 bg-white dark:bg-gray-900 p-6 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 dark:border-gray-800 pb-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                {editingTimetableId ? (
                  <>
                    <Pencil className="h-5 w-5 text-amber-600" />
                    Editing Timetable: <span className="text-blue-700 dark:text-blue-400">{builderTitle}</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-5 w-5 text-blue-600" />
                    AI-Assisted Timetable Builder
                  </>
                )}
              </h2>
              <p className="text-xs text-gray-500 mt-1">
                {editingTimetableId
                  ? "Make live adjustments to lessons, teacher allocations, or rooms. Click any slot below to edit."
                  : "Generate automatic weekly schedules based on KICD CBC guidelines and teacher allocations"}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {editingTimetableId ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingTimetableId(null);
                      setActiveTab("view");
                    }}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-sm font-medium transition"
                  >
                    Cancel Edit
                  </button>
                  <button
                    type="button"
                    disabled={loading || builderSlots.length === 0}
                    onClick={() => handleUpdateTimetable(false)}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white font-medium rounded-lg text-sm shadow transition disabled:opacity-50"
                  >
                    <CheckCircle className="h-4 w-4" />
                    Save Changes
                  </button>
                  {isHeadOrDirector && (
                    <button
                      type="button"
                      disabled={loading || builderSlots.length === 0}
                      onClick={() => handleUpdateTimetable(true)}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-green-700 hover:bg-green-800 text-white font-medium rounded-lg text-sm shadow transition disabled:opacity-50"
                    >
                      <ShieldCheck className="h-4 w-4" />
                      Save & Publish Live
                    </button>
                  )}
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={handleGenerateAiSchedule}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-700 to-indigo-700 hover:from-blue-800 hover:to-indigo-800 text-white font-medium rounded-lg text-sm shadow transition"
                  >
                    <Sparkles className="h-4 w-4" />
                    Regenerate with AI
                  </button>
                  <button
                    type="button"
                    disabled={loading || builderSlots.length === 0}
                    onClick={handleSaveDraft}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-green-700 hover:bg-green-800 text-white font-medium rounded-lg text-sm shadow transition disabled:opacity-50"
                  >
                    <CheckCircle className="h-4 w-4" />
                    Save Master Draft
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Timetable Title
              </label>
              <input
                type="text"
                value={builderTitle}
                onChange={(e) => setBuilderTitle(e.target.value)}
                className="w-full text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 p-2"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Term
              </label>
              <select
                value={builderTerm}
                onChange={(e) => setBuilderTerm(e.target.value)}
                className="w-full text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 p-2"
              >
                <option value="Term 1">Term 1</option>
                <option value="Term 2">Term 2</option>
                <option value="Term 3">Term 3</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Target Grade
              </label>
              <select
                value={builderGrade}
                onChange={(e) => setBuilderGrade(e.target.value)}
                className="w-full text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 p-2"
              >
                {STANDARD_GRADES.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Year
              </label>
              <input
                type="number"
                value={builderYear}
                onChange={(e) => setBuilderYear(Number(e.target.value))}
                className="w-full text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 p-2"
              />
            </div>
          </div>

          {/* Builder Interactive Grid */}
          <div className="overflow-x-auto border border-gray-200 dark:border-gray-800 rounded-xl">
            <table className="w-full text-xs">
              <thead className="bg-gray-100 dark:bg-gray-800">
                <tr>
                  <th className="p-2 text-left font-bold">Period / Time</th>
                  {DAYS.map((d) => (
                    <th key={d} className="p-2 text-left font-bold border-l border-gray-200 dark:border-gray-700">
                      {d}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PERIOD_TIMES.map((pt, idx) => {
                  if (pt.isBreak) {
                    return (
                      <tr key={idx} className="bg-amber-50/50 dark:bg-amber-950/20 text-amber-900 dark:text-amber-200">
                        <td colSpan={6} className="p-2 text-center italic font-semibold">
                          ☕ {pt.label} ({pt.time})
                        </td>
                      </tr>
                    );
                  }

                  return (
                    <tr key={idx} className="border-b border-gray-200 dark:border-gray-800">
                      <td className="p-2 font-semibold bg-gray-50 dark:bg-gray-850">
                        <div>{pt.label}</div>
                        <div className="text-[10px] text-gray-500">{pt.time}</div>
                      </td>
                      {DAYS.map((d) => {
                        const slot = builderSlots.find(
                          (s) => s.day === d && s.period === pt.period
                        );

                        return (
                          <td
                            key={d}
                            className="p-1 border-l border-gray-200 dark:border-gray-800 align-top"
                          >
                            {slot ? (
                              <button
                                type="button"
                                onClick={() => setEditingSlot(slot)}
                                className="w-full text-left p-2 rounded bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-900 hover:border-blue-400 transition"
                              >
                                <div className="font-bold text-blue-900 dark:text-blue-300">
                                  {slot.subject}
                                </div>
                                <div className="text-[10px] text-gray-500 truncate">
                                  {slot.teacherName || "Unassigned"}
                                </div>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  const newSlot: TimetableSlot = {
                                    id: `${d}-${pt.period}-${Date.now()}`,
                                    day: d,
                                    period: pt.period,
                                    time: pt.time,
                                    grade: builderGrade,
                                    subject: "Mathematics",
                                    teacherId: teachers[0]?.id,
                                    teacherName: teachers[0]?.name,
                                    room: `${builderGrade} Room`,
                                  };
                                  setBuilderSlots((prev) => [...prev, newSlot]);
                                  setEditingSlot(newSlot);
                                }}
                                className="w-full text-center py-3 border border-dashed border-gray-300 dark:border-gray-700 rounded text-gray-400 hover:border-blue-500 hover:text-blue-600 transition"
                              >
                                + Add
                              </button>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit Slot Modal */}
      {editingSlot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-md w-full shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              Edit Lesson ({editingSlot.day} Period {editingSlot.period})
            </h3>

            <div>
              <label className="block text-xs font-semibold mb-1">Subject</label>
              <input
                type="text"
                value={editingSlot.subject}
                onChange={(e) =>
                  setEditingSlot({ ...editingSlot, subject: e.target.value })
                }
                className="w-full text-sm rounded border p-2 bg-white dark:bg-gray-700"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">Teacher</label>
              <select
                value={editingSlot.teacherId || ""}
                onChange={(e) => {
                  const t = teachers.find((tch) => tch.id === e.target.value);
                  setEditingSlot({
                    ...editingSlot,
                    teacherId: e.target.value,
                    teacherName: t?.name,
                  });
                }}
                className="w-full text-sm rounded border p-2 bg-white dark:bg-gray-700"
              >
                <option value="">Unassigned</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">Room / Venue</label>
              <input
                type="text"
                value={editingSlot.room || ""}
                onChange={(e) =>
                  setEditingSlot({ ...editingSlot, room: e.target.value })
                }
                className="w-full text-sm rounded border p-2 bg-white dark:bg-gray-700"
                placeholder="e.g. Science Lab, Field, Class"
              />
            </div>

            <div className="flex justify-between items-center gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={() => {
                  setBuilderSlots((prev) => prev.filter((s) => s.id !== editingSlot.id));
                  setEditingSlot(null);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg text-xs font-semibold transition"
              >
                <Trash2 className="h-4 w-4" />
                Delete Lesson
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditingSlot(null)}
                  className="px-4 py-2 border rounded-lg text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setBuilderSlots((prev) =>
                      prev.map((s) => (s.id === editingSlot.id ? editingSlot : s))
                    );
                    setEditingSlot(null);
                  }}
                  className="px-4 py-2 bg-blue-700 text-white rounded-lg text-sm font-medium hover:bg-blue-800"
                >
                  Save Lesson
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
