import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { readSession } from "@/lib/session";
import ProfileSettings from "./profile-settings";
import { UserCheck } from "lucide-react";

export default async function ProfilePage() {
  const token = (await cookies()).get("mary_session")?.value;
  const session = token ? await readSession(token) : null;
  if (!session) redirect("/");

  const user = await db.user.findUnique({
    where: { id: session.id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      avatarUrl: true,
      suspended: true,
      forcePasswordChange: true,
    },
  });

  if (!user || user.suspended) redirect("/");
  if (user.forcePasswordChange) redirect("/change-password");

  return (
    <>
      <section className="mx-auto max-w-7xl p-4 pb-28 sm:p-6 md:p-8 space-y-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50/80 px-2.5 py-0.5 text-xs font-semibold text-blue-800 dark:border-blue-800/60 dark:bg-blue-950/40 dark:text-blue-300">
              <UserCheck size={12} />
              Identity Management
            </span>
          </div>
          <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-900 sm:text-3xl dark:text-white">
            Personal Account &amp; Credentials
          </h1>
          <p className="mt-1 text-xs text-slate-500 sm:text-sm dark:text-slate-400">
            Manage your profile picture, email address, and authentication security.
          </p>
        </div>

        <ProfileSettings
          name={user.name}
          email={user.email}
          role={user.role}
          initialAvatar={user.avatarUrl}
        />
      </section>
    </>
  );
}
