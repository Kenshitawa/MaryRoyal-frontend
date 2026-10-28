import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import PortalFrame from "@/components/portal-frame";
import { db } from "@/lib/db";
import { readSession } from "@/lib/session";
import { canInScope } from "@/lib/permissions";
import { logSafeServerError } from "@/lib/safe-server-log";
import { ShieldCheck, Users } from "lucide-react";
import { StaffDirectoryClient } from "./staff-directory-client";

export default async function StaffDirectoryPage() {
  const token = (await cookies()).get("mary_session")?.value;
  const session = token ? await readSession(token) : null;
  if (!session) redirect("/");

  const user = await db.user.findUnique({
    where: { id: session.id },
    select: { id: true, role: true, suspended: true, forcePasswordChange: true },
  });
  if (!user || user.suspended) redirect("/");
  if (user.forcePasswordChange) redirect("/change-password");
  if (!canInScope(user.role, "staff", "view", "school")) redirect("/dashboard");

  const staff = await db.user.findMany({
    where: { role: { notIn: ["PARENT", "LEARNER"] } },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      phone: true,
      avatarUrl: true,
      suspended: true,
      staffNumber: true,
      tscNumber: true,
      employmentTitle: true,
      qualifications: true,
      createdAt: true,
      staffProfile: {
        select: {
          department: true,
          employmentType: true,
        },
      },
    },
    orderBy: [{ role: "asc" }, { name: "asc" }],
  }).catch((error: unknown) => {
    logSafeServerError("staff_directory", error);
    throw new Error("Staff directory could not be loaded.");
  });

  const canCreate = canInScope(user.role, "staff", "create", "school");
  const canExport = canInScope(user.role, "staff", "view", "school");

  return (
    <PortalFrame active="Staff">
      <section className="mx-auto max-w-6xl space-y-6 p-4 pb-28 sm:p-6 md:p-8">
        {/* Hero Section */}
        <div className="bento-card relative overflow-hidden rounded-3xl border border-blue-100 bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-900 p-6 text-white shadow-xl shadow-blue-950/10 sm:p-8 dark:border-blue-900/50">
          <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-400/20 px-3 py-1 text-xs font-bold text-blue-200 ring-1 ring-inset ring-blue-300/30">
                <ShieldCheck size={14} className="text-blue-300" />
                Staff Directory · Mary Royal School
              </span>
              <h1 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">
                School Faculty &amp; Staff
              </h1>
              <p className="sr-only">Staff profiles</p>
              <p className="mt-1 text-xs text-blue-100 sm:text-sm">
                Active team members, teaching assignments, contact details, and qualifications.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-2 rounded-2xl bg-white/10 px-4 py-2.5 text-xs font-bold text-white backdrop-blur">
                <Users size={16} />
                {staff.filter((s) => !s.suspended).length} Active Staff
              </span>
            </div>
          </div>
        </div>

        {/* Client directory controls and card list */}
        <StaffDirectoryClient
          initialStaff={staff}
          canCreate={canCreate}
          canExport={canExport}
          userRole={user.role}
        />
      </section>
    </PortalFrame>
  );
}
