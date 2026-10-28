import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { readSession } from "@/lib/session";
import { can } from "@/lib/permissions";
import WelfareClient from "./welfare-client";

export const metadata = { title: "Staff Welfare — Mary Royal School" };

export default async function WelfarePage() {
  const token = (await cookies()).get("mary_session")?.value;
  const session = token ? await readSession(token) : null;
  if (!session) redirect("/");
  const user = await db.user.findUnique({ where: { id: session.id }, select: { id: true, role: true, name: true, suspended: true, forcePasswordChange: true } });
  if (!user || user.suspended) redirect("/");
  if (user.forcePasswordChange) redirect("/change-password");
  if (!can(user.role as never, "welfare", "view")) redirect("/dashboard");

  return (
    <>
      <WelfareClient role={user.role} userId={user.id} userName={user.name} />
    </>
  );
}
