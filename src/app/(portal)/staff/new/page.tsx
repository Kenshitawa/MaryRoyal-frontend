import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { readSession } from "@/lib/session";
import { canInScope } from "@/lib/permissions";
import { StaffWizard } from "./staff-wizard";

export default async function AddStaffPage() {
  const token = (await cookies()).get("mary_session")?.value;
  const session = token ? await readSession(token) : null;
  if (!session) redirect("/");

  const user = await db.user.findUnique({
    where: { id: session.id },
    select: { id: true, role: true, suspended: true, forcePasswordChange: true },
  });
  if (!user || user.suspended) redirect("/");
  if (user.forcePasswordChange) redirect("/change-password");

  if (!canInScope(user.role, "staff", "create", "school")) {
    redirect("/staff");
  }

  return (
    <>
      <section className="mx-auto max-w-4xl space-y-6 p-4 pb-28 sm:p-6 md:p-8">
        <StaffWizard userRole={user.role} />
      </section>
    </>
  );
}
