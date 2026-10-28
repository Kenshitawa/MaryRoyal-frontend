import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { readSession } from "@/lib/session";
import { can } from "@/lib/permissions";
import LibraryClient from "./library-client";

export const metadata = { title: "Library — Mary Royal School" };

export default async function LibraryPage() {
  const token = (await cookies()).get("mary_session")?.value;
  const session = token ? await readSession(token) : null;
  if (!session) redirect("/");
  const user = await db.user.findUnique({ where: { id: session.id }, select: { id: true, role: true, name: true, suspended: true, forcePasswordChange: true } });
  if (!user || user.suspended) redirect("/");
  if (user.forcePasswordChange) redirect("/change-password");
  if (!can(user.role as never, "textbooks", "view")) redirect("/dashboard");

  return (
    <>
      <LibraryClient role={user.role} userId={user.id} />
    </>
  );
}
