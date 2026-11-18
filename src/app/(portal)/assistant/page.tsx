import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { readSession } from "@/lib/session";
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
    <section className={`mx-auto flex w-full max-w-4xl flex-col gap-2 px-3 pt-3 pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:gap-3 md:px-8 md:py-8 ${user.role === "LEARNER" ? "learner-assistant" : ""}`}>
      <header className="shrink-0">
        <h1 className="text-title-3-semibold text-text-primary">{user.role === "LEARNER" ? `Learning helper for ${firstName}` : family ? `Hello ${firstName}` : "Ask me anything"}</h1>
        <p className="text-body-2-regular text-text-secondary">Ask about school. Replies stay private and use records you can already see.</p>
      </header>
      <AssistantChat firstName={firstName} role={user.role} />
    </section>
  );
}
