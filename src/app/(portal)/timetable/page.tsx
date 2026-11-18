import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { readSession } from "@/lib/session";
import { can } from "@/lib/permissions";
import TimetableClient from "./timetable-client";

export const metadata = { title: "School Timetable — Mary Royal School" };

export default async function TimetablePage() {
  const token = (await cookies()).get("mary_session")?.value;
  const session = token ? await readSession(token) : null;
  if (!session) redirect("/");
  const user = await db.user.findUnique({
    where: { id: session.id },
    select: { id: true, role: true, name: true, suspended: true, forcePasswordChange: true },
  });
  if (!user || user.suspended) redirect("/");
  if (user.forcePasswordChange) redirect("/change-password");
  if (!can(user.role as never, "timetable", "view")) redirect("/dashboard");

  const isAdmin = ["DIRECTOR", "HEAD_TEACHER", "DEPUTY", "SENIOR_TEACHER"].includes(user.role);

  const [timetables, teachers, assignments] = await Promise.all([
    db.schoolTimetable.findMany({
      where: isAdmin ? {} : { status: "PUBLISHED" },
      include: {
        createdBy: { select: { id: true, name: true } },
        verifiedBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    // Cast the enum to text so this page remains usable while a production
    // database is catching up with the SENIOR_TEACHER enum migration. Prisma
    // sends enum labels as typed values, which makes the entire page fail on
    // older databases even though the rest of the timetable schema is ready.
    db.$queryRaw<Array<{ id: string; name: string }>>`
      SELECT "id", "name"
      FROM "User"
      WHERE "role"::text IN ('TEACHER', 'DEPUTY', 'SENIOR_TEACHER')
        AND "suspended" = false
      ORDER BY "name" ASC
    `,
    db.teacherAssignment.findMany({
      select: { teacherId: true, grade: true, subject: true },
    }),
  ]);

  return (
    <>
      <TimetableClient
        role={user.role}
        userId={user.id}
        userName={user.name}
        timetables={timetables}
        teachers={teachers}
        assignments={assignments}
      />
    </>
  );
}
