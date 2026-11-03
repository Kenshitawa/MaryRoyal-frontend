import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { readSession } from "@/lib/session";
import { PageShell } from "@/components/ui/page-shell";

const roleTitle: Record<string, string> = {
  DIRECTOR: "Director",
  HEAD_TEACHER: "Head Teacher",
  DEPUTY: "Deputy Head Teacher",
  SECRETARY: "Secretary",
  ACCOUNTANT: "Accountant",
  TEACHER: "Teacher",
  WELFARE_CHAIR: "Welfare Chair",
  NON_TEACHING_STAFF: "Non-Teaching Staff",
  PARENT: "Parent",
  LEARNER: "Learner",
};

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const token = (await cookies()).get("mary_session")?.value;
  const session = token ? await readSession(token) : null;
  if (!session) redirect("/");

  const user = await db.user.findUnique({
    where: { id: session.id },
    select: { id: true, name: true, email: true, role: true, avatarUrl: true, suspended: true, forcePasswordChange: true },
  });
  if (!user || user.suspended) redirect("/");
  if (user.forcePasswordChange) redirect("/change-password");

  let hiddenLabels: string[] = [];
  if (user.role === "TEACHER") {
    const classTeacher = await db.classTeacherAssignment.findFirst({
      where: { teacherId: user.id },
      select: { id: true },
    });
    if (!classTeacher) hiddenLabels = ["Attendance"];
  }

  return (
    <PageShell
      user={{
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        roleLabel: roleTitle[user.role] ?? user.role,
        avatarUrl: user.avatarUrl,
      }}
      hiddenLabels={hiddenLabels}
    >
      {children}
    </PageShell>
  );
}
