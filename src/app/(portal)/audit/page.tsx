import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { readSession } from "@/lib/session";
import { canInScope } from "@/lib/permissions";
import { Search, ShieldCheck, Clock, AlertTriangle, Filter } from "lucide-react";

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; entity?: string }>;
}) {
  const token = (await cookies()).get("mary_session")?.value;
  const session = token ? await readSession(token) : null;
  if (!session) redirect("/");

  const user = await db.user.findUnique({
    where: { id: session.id },
    select: { role: true, suspended: true, forcePasswordChange: true },
  });
  if (!user || user.suspended) redirect("/");
  if (user.forcePasswordChange) redirect("/change-password");
  if (!canInScope(user.role, "audit", "view", "school")) redirect("/dashboard");

  const params = await searchParams;
  const action = params.action?.slice(0, 80);
  const entity = params.entity?.slice(0, 80);

  const events = await db.auditEvent.findMany({
    where: {
      ...(action ? { action: { contains: action } } : {}),
      ...(entity ? { entity: { contains: entity } } : {}),
    },
    include: {
      actor: { select: { name: true, email: true, role: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  // Get unique action types and entity types for filter chips
  const actionTypes = ["LOGIN_SUCCEEDED", "LOGIN_FAILED", "ACCESS_DENIED", "PROFILE_VIEW", "HEALTH_VIEW"];

  function getActionBadgeStyle(actionStr: string) {
    if (actionStr.includes("DENIED") || actionStr.includes("FAILED")) {
      return "bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300";
    }
    if (actionStr.includes("LOGIN")) {
      return "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300";
    }
    if (actionStr.includes("VIEW")) {
      return "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300";
    }
    return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
  }

  return (
    <>
      <section className="mx-auto max-w-7xl space-y-6 p-4 pb-28 sm:p-6 lg:p-8">
        {/* Hero Header */}
        <div className="bento-card overflow-hidden rounded-3xl border border-blue-100 bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-900 p-6 text-white shadow-xl shadow-blue-950/10 sm:p-8 dark:border-blue-900/50">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-400/20 px-3 py-1 text-xs font-bold text-blue-200 ring-1 ring-inset ring-blue-300/30">
                <ShieldCheck size={14} className="text-blue-300" />
                Governance &amp; Security Trail
              </span>
              <h1 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">Audit Log</h1>
              <p className="mt-1 text-xs text-blue-100 sm:text-sm">
                An immutable, chronological trail of all sensitive actions and sign-in events.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-2 rounded-2xl bg-white/10 px-4 py-2.5 text-xs font-bold text-white">
                <Clock size={15} />
                {events.length} events
              </span>
            </div>
          </div>
        </div>

        {/* Filter Controls */}
        <form className="bento-card flex flex-col gap-3 rounded-2xl border border-slate-200/90 bg-white/95 p-4 shadow-sm backdrop-blur sm:flex-row sm:items-end dark:border-slate-800 dark:bg-slate-900/90">
          <label className="flex-1 text-xs font-bold text-slate-700 dark:text-slate-300">
            Filter by action keyword
            <div className="relative mt-1.5">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                name="action"
                defaultValue={action}
                maxLength={80}
                placeholder="e.g. LOGIN or DENIED"
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-4 text-xs text-slate-900 outline-none transition focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:border-blue-500"
              />
            </div>
          </label>

          <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
            Filter by entity
            <input
              name="entity"
              defaultValue={entity}
              maxLength={80}
              placeholder="e.g. User or Learner"
              className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 text-xs text-slate-900 outline-none transition focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-100 sm:w-44 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </label>

          <button
            type="submit"
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-blue-700 px-5 text-xs font-bold text-white transition hover:bg-blue-800"
          >
            <Filter size={14} />
            Apply
          </button>
        </form>

        {/* Quick filter chips */}
        <div className="flex flex-wrap gap-2">
          {actionTypes.map((at) => (
            <a
              key={at}
              href={`/audit?action=${at}`}
              className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider transition hover:opacity-80 ${
                action === at
                  ? "bg-blue-700 text-white"
                  : "border border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
              }`}
            >
              {at.replaceAll("_", " ")}
            </a>
          ))}
          {(action || entity) && (
            <a
              href="/audit"
              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-rose-600 transition hover:bg-rose-50 dark:border-slate-700 dark:bg-slate-800"
            >
              Clear Filters ✕
            </a>
          )}
        </div>

        {/* Audit Log Table */}
        <section className="bento-card overflow-hidden rounded-2xl border border-slate-200/90 bg-white/95 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
          <div className="sticky top-0 z-10 hidden grid-cols-[1.5fr_1.2fr_1.5fr_0.8fr_1fr] gap-4 border-b border-slate-100 bg-slate-50/95 px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 backdrop-blur sm:grid dark:border-slate-800 dark:bg-slate-800/80 dark:text-slate-400">
            <span>When (EAT)</span>
            <span>Actor</span>
            <span>Action</span>
            <span>Record Type</span>
            <span>Record ID</span>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {events.length ? (
              events.map((event) => (
                <div
                  key={event.id}
                  className="grid gap-1 px-4 py-3 text-xs transition hover:bg-blue-50/30 sm:grid-cols-[1.5fr_1.2fr_1.5fr_0.8fr_1fr] sm:items-center sm:gap-4 sm:px-5 dark:hover:bg-blue-950/20"
                >
                  <time className="whitespace-nowrap text-slate-500 dark:text-slate-400">
                    {new Intl.DateTimeFormat("en-KE", {
                      dateStyle: "medium",
                      timeStyle: "short",
                      timeZone: "Africa/Nairobi",
                    }).format(event.createdAt)}
                  </time>

                  <p className="truncate font-semibold text-slate-800 dark:text-slate-200">
                    {event.actor
                      ? `${event.actor.name} · ${event.actor.role.replaceAll("_", " ")}`
                      : "System"}
                  </p>

                  <span
                    className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${getActionBadgeStyle(
                      event.action
                    )}`}
                  >
                    {event.action.includes("DENIED") || event.action.includes("FAILED") ? (
                      <AlertTriangle size={10} />
                    ) : (
                      <ShieldCheck size={10} />
                    )}
                    {event.action.replaceAll("_", " ")}
                  </span>

                  <p className="text-slate-600 dark:text-slate-300">{event.entity}</p>

                  <p className="truncate font-mono text-[10px] text-slate-400">{event.entityId ?? "—"}</p>
                </div>
              ))
            ) : (
              <div className="p-12 text-center">
                <ShieldCheck size={28} className="mx-auto text-blue-200 dark:text-blue-800" />
                <p className="mt-3 text-sm font-bold text-slate-700 dark:text-slate-300">No matching audit events</p>
                <p className="mt-1 text-xs text-slate-400">Try different filter terms or clear to see all events.</p>
              </div>
            )}
          </div>
        </section>
      </section>
    </>
  );
}
