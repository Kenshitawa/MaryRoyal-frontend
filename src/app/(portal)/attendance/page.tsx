import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { readSession } from "@/lib/session";
import { canInScope } from "@/lib/permissions";
import AttendanceClient from "./attendance-client";
import StaffAttendanceClient from "./staff-attendance-client";
import {
  Calendar,
  CheckCircle2,
  UserCheck,
  Users,
  UserX,
} from "lucide-react";

export default async function AttendancePage() {
  const token = (await cookies()).get("mary_session")?.value;
  const session = token ? await readSession(token) : null;
  if (!session) redirect("/");

  const user = await db.user.findUnique({
    where: { id: session.id },
    select: { id: true, role: true, suspended: true, forcePasswordChange: true },
  });

  if (!user || user.suspended) redirect("/");
  if (user.forcePasswordChange) redirect("/change-password");
  if (
    !canInScope(
      user.role,
      "attendance",
      "view",
      user.role === "TEACHER" ? "assigned" : "school"
    )
  ) {
    redirect("/dashboard");
  }

  const assigned =
    user.role === "TEACHER"
      ? await db.classTeacherAssignment.findMany({
          where: { teacherId: user.id },
          select: { grade: true },
        })
      : [];

  const grades =
    user.role === "TEACHER"
      ? assigned.map((x) => x.grade)
      : ["PP1", "PP2", ...Array.from({ length: 9 }, (_, i) => `Grade ${i + 1}`)];

  const date = new Date(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Africa/Nairobi",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date()) + "T00:00:00.000Z"
  );

  const overview = canInScope(user.role, "attendance", "view", "school")
    ? await Promise.all([
        db.learner.groupBy({
          by: ["grade"],
          where: { archivedAt: null },
          _count: { id: true },
          orderBy: { grade: "asc" },
        }),
        db.attendance.findMany({
          where: { date },
          select: { learnerId: true, status: true, learner: { select: { grade: true } } },
        }),
      ])
    : null;

  const staff = canInScope(user.role, "staffAttendance", "create", "school")
    ? await db.user.findMany({
        where: {
          suspended: false,
          role: {
            in: [
              "DIRECTOR",
              "HEAD_TEACHER",
              "DEPUTY",
              "SECRETARY",
              "ACCOUNTANT",
              "TEACHER",
            ],
          },
        },
        select: { id: true, name: true, role: true, staffNumber: true },
        orderBy: { name: "asc" },
      })
    : [];

  const classes = overview
    ? overview[0].map((item) => {
        const rows = overview[1].filter((row) => row.learner.grade === item.grade);
        const present = rows.filter((row) => row.status === "PRESENT").length;
        const absent = rows.filter((row) => row.status === "ABSENT").length;
        const late = rows.filter((row) => row.status === "LATE").length;
        return {
          grade: item.grade,
          total: item._count.id,
          marked: rows.length,
          present,
          absent,
          late,
        };
      })
    : [];

  const counts = classes.reduce(
    (sum, item) => ({
      total: sum.total + item.total,
      marked: sum.marked + item.marked,
      present: sum.present + item.present,
      absent: sum.absent + item.absent,
      late: sum.late + item.late,
    }),
    { total: 0, marked: 0, present: 0, absent: 0, late: 0 }
  );

  const completionPct = counts.total ? Math.round((counts.marked / counts.total) * 100) : 0;

  return (
    <>
      <section className="mx-auto max-w-7xl space-y-6 p-4 pb-28 sm:p-6 md:p-8">
        {overview && (
          <>
            {/* Header */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50/80 px-2.5 py-0.5 text-xs font-semibold text-blue-800 dark:border-blue-800/60 dark:bg-blue-950/40 dark:text-blue-300">
                    <Calendar size={12} />
                    {new Intl.DateTimeFormat("en-KE", {
                      dateStyle: "full",
                      timeZone: "Africa/Nairobi",
                    }).format(date)}
                  </span>
                </div>
                <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-900 sm:text-3xl dark:text-white">
                  Schoolwide Attendance
                </h1>
                <p className="mt-1 text-xs text-slate-500 sm:text-sm dark:text-slate-400">
                  Daily learner presence tracking, class register progress, and absentee follow-up.
                </p>
              </div>
            </div>

            {/* KPI Bento Grid */}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <div className="glass dark:glass-dark rounded-3xl border border-slate-200/80 p-5 shadow-sm dark:border-slate-800/80">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Enrolled Learners
                  </span>
                  <div className="rounded-xl bg-blue-50 p-2 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400">
                    <Users size={16} />
                  </div>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-2xl font-black text-slate-900 dark:text-white">
                    {counts.total}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Across active classes
                </p>
              </div>

              <div className="glass dark:glass-dark rounded-3xl border border-slate-200/80 p-5 shadow-sm dark:border-slate-800/80">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Present Today
                  </span>
                  <div className="rounded-xl bg-emerald-50 p-2 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400">
                    <UserCheck size={16} />
                  </div>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-2xl font-black text-emerald-700 dark:text-emerald-400">
                    {counts.present}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {counts.late} recorded late
                </p>
              </div>

              <div className="glass dark:glass-dark rounded-3xl border border-slate-200/80 p-5 shadow-sm dark:border-slate-800/80">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Absent Today
                  </span>
                  <div className="rounded-xl bg-red-50 p-2 text-red-700 dark:bg-red-950/60 dark:text-red-400">
                    <UserX size={16} />
                  </div>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-2xl font-black text-red-700 dark:text-red-400">
                    {counts.absent}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Requires guardian follow-up
                </p>
              </div>

              <div className="glass dark:glass-dark rounded-3xl border border-slate-200/80 p-5 shadow-sm dark:border-slate-800/80">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Registers Marked
                  </span>
                  <div className="rounded-xl bg-indigo-50 p-2 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-400">
                    <CheckCircle2 size={16} />
                  </div>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-2xl font-black text-indigo-700 dark:text-indigo-400">
                    {completionPct}%
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {classes.filter((c) => c.marked === c.total && c.total > 0).length} of{" "}
                  {classes.filter((c) => c.total > 0).length} classes
                </p>
              </div>
            </div>

            {/* Class Registers Overview Grid */}
            <section className="glass dark:glass-dark rounded-3xl border border-slate-200/80 p-6 shadow-sm dark:border-slate-800/80">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
                <div>
                  <h2 className="text-lg font-black tracking-tight text-slate-900 dark:text-white">
                    Class Registers Status
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Real-time completion percentage by stream and class.
                  </p>
                </div>
              </div>

              <div className="mt-5 grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
                {classes.map((item) => {
                  const isDone = item.marked === item.total && item.total > 0;
                  const pct = item.total ? Math.round((item.marked / item.total) * 100) : 0;

                  return (
                    <article
                      key={item.grade}
                      className="rounded-2xl border border-slate-200/70 bg-white/70 p-4 transition-all hover:border-blue-200 hover:shadow-xs dark:border-slate-800 dark:bg-slate-900/50"
                    >
                      <div className="flex items-center justify-between">
                        <h3 className="font-black text-slate-900 dark:text-white">{item.grade}</h3>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                            isDone
                              ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                              : "bg-amber-50 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300"
                          }`}
                        >
                          {isDone ? "Complete" : `${item.total - item.marked} unmarked`}
                        </span>
                      </div>

                      {/* Progress Bar */}
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            isDone
                              ? "bg-gradient-to-r from-emerald-500 to-teal-500"
                              : "bg-gradient-to-r from-blue-600 to-indigo-600"
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>

                      <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                        <span>
                          {item.present} Present · {item.absent} Absent · {item.late} Late
                        </span>
                        <span className="font-bold text-slate-700 dark:text-slate-300">
                          {item.total} Learners
                        </span>
                      </div>
                    </article>
                  );
                })}
              </div>

              {!classes.length && (
                <p className="mt-4 rounded-2xl bg-slate-50 p-6 text-center text-xs text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
                  No active class register configured yet.
                </p>
              )}
            </section>
          </>
        )}

        {user.role === "TEACHER" && (
          <div className="glass dark:glass-dark rounded-3xl border border-slate-200/80 p-6 shadow-sm dark:border-slate-800/80">
            <h1 className="text-2xl font-black text-slate-900 dark:text-white">
              My Class Register
            </h1>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Only class teachers can mark and verify daily attendance for their assigned classroom.
            </p>
          </div>
        )}

        {canInScope(user.role, "staffAttendance", "create", "school") && (
          <StaffAttendanceClient staff={staff} />
        )}

        <AttendanceClient grades={grades} />
      </section>
    </>
  );
}
