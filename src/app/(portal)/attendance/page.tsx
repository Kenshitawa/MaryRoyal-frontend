import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { readSession } from "@/lib/session";
import { canInScope } from "@/lib/permissions";
import AttendanceClient from "./attendance-client";
import StaffAttendanceClient from "./staff-attendance-client";
import { Card, EmptyState, PageHeader, StatCard } from "@/components/ui/primitives";
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
        <PageHeader
          title={overview ? "Schoolwide Attendance" : "My Class Attendance"}
          meta={
            <span className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-brand-line bg-brand-soft px-2.5 text-caption font-semibold text-brand-ink">
              <Calendar size={14} aria-hidden="true" />
              {new Intl.DateTimeFormat("en-KE", { dateStyle: "full", timeZone: "Africa/Nairobi" }).format(date)}
            </span>
          }
          help={overview ? "Daily learner presence, class register progress and absentee follow-up." : "Mark and verify daily attendance for your assigned class."}
        />

        {overview && (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard label="Enrolled learners" value={counts.total} note="Across active classes" icon={Users} />
              <StatCard label="Present today" value={counts.present} note={`${counts.late} recorded late`} icon={UserCheck} tone="success" />
              <StatCard label="Absent today" value={counts.absent} note="Needs guardian follow-up" icon={UserX} tone="danger" />
              <StatCard label="Registers marked" value={`${completionPct}%`} note={`${classes.filter((c) => c.marked === c.total && c.total > 0).length} of ${classes.filter((c) => c.total > 0).length} classes`} icon={CheckCircle2} tone="neutral" />
            </div>

            <Card title="Class registers" description="Completion by class for today.">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {classes.map((item) => {
                  const isDone = item.marked === item.total && item.total > 0;
                  const pct = item.total ? Math.round((item.marked / item.total) * 100) : 0;
                  return (
                    <article key={item.grade} className="min-w-0 rounded-xl border border-hairline bg-surface-2/40 p-3.5">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-title font-semibold text-ink">{item.grade}</h3>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-caption font-semibold ${isDone ? "bg-success-soft text-success" : "bg-warning-soft text-warning"}`}>
                          {isDone ? "Complete" : `${item.total - item.marked} unmarked`}
                        </span>
                      </div>
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-3">
                        <div className={`h-full rounded-full transition-[width] duration-500 ${isDone ? "bg-success" : "bg-brand"}`} style={{ width: `${pct}%` }} />
                      </div>
                      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-x-2 text-label text-ink-2">
                        <span>{item.present} present · {item.absent} absent · {item.late} late</span>
                        <span className="font-semibold text-ink">{item.total} learners</span>
                      </div>
                    </article>
                  );
                })}
              </div>
              {!classes.length && (
                <EmptyState icon={Users} title="No class registers yet" description="Classes appear here once learners are admitted." />
              )}
            </Card>

          </>
        )}

        {user.role === "TEACHER" && (
          <Card title="My class register" description="Class teachers mark and verify daily attendance for their assigned classroom." />
        )}

        {canInScope(user.role, "staffAttendance", "create", "school") && (
          <StaffAttendanceClient staff={staff} />
        )}

        <AttendanceClient grades={grades} />
      </section>
    </>
  );
}
