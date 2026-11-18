import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { readSession } from "@/lib/session";
import { PageHeader } from "@/components/ui/primitives";
import { AssistantChat } from "./assistant-chat";

export default async function AssistantPage() {
  const token = (await cookies()).get("mary_session")?.value;
  const session = token ? await readSession(token) : null;
  if (!session) redirect("/");
  const user = await db.user.findUnique({ where: { id: session.id } });
  if (!user || user.suspended) redirect("/");
  if (user.forcePasswordChange) redirect("/change-password");
  const family = user.role === "PARENT" || user.role === "LEARNER";

  const firstName = user.name.trim().split(/\s+/)[0] || "there";

  return (
    <section className={`mx-auto max-w-4xl p-4 pb-28 md:p-8 ${user.role === "LEARNER" ? "learner-assistant" : ""}`}>
      <PageHeader
        title={user.role === "LEARNER" ? `Your learning helper, ${firstName}` : family ? `Hello ${firstName}` : "Ask me anything"}
        help={
          family
            ? "A private helper that answers from your own linked school records only. It never sends your details to an outside AI service."
            : "A private, read-only assistant for school totals and pending work. It answers with the records your role is allowed to see."
        }
      />
      <AssistantChat firstName={firstName} role={user.role} />
    </section>
  );
}
