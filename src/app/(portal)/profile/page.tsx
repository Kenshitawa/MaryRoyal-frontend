import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { readSession } from "@/lib/session";
import ProfileSettings from "./profile-settings";
import { PageHeader } from "@/components/ui/primitives";

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
      <section className="mx-auto max-w-7xl space-y-3">
        <PageHeader
          title="Personal Account & Credentials"
          help="Manage your profile picture, email address, and authentication security."
          meta="Identity management"
        />

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
