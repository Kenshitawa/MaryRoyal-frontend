import Image from "next/image";
import Link from "next/link";
import { Role } from "@prisma/client";
import {
  Activity,
  ArrowUpRight,
  Building2,
  CheckCircle2,
  GraduationCap,
  Plus,
  Search,
  Users,
} from "lucide-react";
import { db } from "@/lib/db";
import { getPlatformActor } from "@/lib/platform-auth";
import { tenantHomeUrl } from "@/lib/tenant-host";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 12;

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-KE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(value);
}

function statusClasses(status: string) {
  if (status === "ACTIVE") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "SUSPENDED") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-slate-200 bg-slate-50 text-slate-600";
}

export default async function PlatformDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const actor = await getPlatformActor();
  const params = await searchParams;
  const q = (params.q ?? "").trim().slice(0, 100);
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);

  const where = q
    ? {
        OR: [
          { name: { contains: q } },
          { slug: { contains: q } },
          { contactEmail: { contains: q } },
        ],
      }
    : {};

  const [totalSchools, activeSchools, learnerCount, userCount, totalMatching, schools, recentEvents] =
    await Promise.all([
      db.school.count(),
      db.school.count({ where: { status: "ACTIVE" } }),
      db.learner.count(),
      db.user.count(),
      db.school.count({ where }),
      db.school.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        select: {
          id: true,
          name: true,
          slug: true,
          logoUrl: true,
          status: true,
          createdAt: true,
          users: {
            where: { role: Role.DIRECTOR },
            take: 1,
            select: { name: true, email: true },
          },
          _count: { select: { learners: true, users: true } },
        },
      }),
      db.platformAuditEvent.findMany({
        orderBy: { createdAt: "desc" },
        take: 6,
        select: {
          id: true,
          action: true,
          entity: true,
          actorEmail: true,
          createdAt: true,
        },
      }),
    ]);

  const totalPages = Math.max(1, Math.ceil(totalMatching / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const stats = [
    { label: "Schools", value: totalSchools, note: `${activeSchools} active`, icon: Building2 },
    { label: "Learners", value: learnerCount, note: "Across all tenants", icon: GraduationCap },
    { label: "User accounts", value: userCount, note: "Staff, parents and learners", icon: Users },
    { label: "Active tenants", value: activeSchools, note: `${totalSchools - activeSchools} suspended`, icon: CheckCircle2 },
  ];

  function pageHref(target: number) {
    const query = new URLSearchParams();
    if (q) query.set("q", q);
    if (target > 1) query.set("page", String(target));
    const suffix = query.toString();
    return suffix ? `/super-admin?${suffix}` : "/super-admin";
  }

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[.16em] text-teal-700">Platform overview</p>
          <h1 className="mt-1.5 text-2xl font-extrabold tracking-tight text-slate-950 sm:text-3xl">
            Welcome back, {actor?.name.split(" ")[0] ?? "Administrator"}
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm text-slate-500">
            Provision schools, check tenant health and confirm that every subdomain is running the shared
            School Core template.
          </p>
        </div>
        <Link
          href="/super-admin/schools/new"
          className="inline-flex h-11 items-center gap-2 rounded-xl bg-teal-800 px-4 text-sm font-bold text-white shadow-sm transition hover:bg-teal-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
        >
          <Plus size={17} aria-hidden="true" /> Add school
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <p className="text-[11px] font-bold uppercase tracking-[.1em] text-slate-500">{stat.label}</p>
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-teal-50 text-teal-700" aria-hidden="true">
                  <Icon size={16} />
                </span>
              </div>
              <p className="mt-2 text-2xl font-extrabold tracking-tight text-slate-950 tabular-nums">
                {stat.value.toLocaleString("en-KE")}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-500">{stat.note}</p>
            </div>
          );
        })}
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-100 px-4 py-4 sm:px-5">
          <div>
            <h2 className="text-base font-bold text-slate-950">Schools on the platform</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {q ? `${totalMatching} match “${q}”` : `${totalSchools} provisioned ${totalSchools === 1 ? "school" : "schools"}`}
            </p>
          </div>
          <form method="get" className="flex w-full items-center gap-2 sm:w-auto">
            <label className="relative min-w-0 flex-1 sm:w-64">
              <span className="sr-only">Search schools by name, subdomain or email</span>
              <Search
                size={15}
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                name="q"
                defaultValue={q}
                placeholder="Search name, subdomain, email"
                className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-xs font-medium text-slate-900 outline-none transition focus:border-teal-600 focus:bg-white focus:ring-2 focus:ring-teal-100"
              />
            </label>
            <button className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50">
              Search
            </button>
          </form>
        </div>

        {schools.length === 0 ? (
          <div className="px-5 py-14 text-center">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-slate-100 text-slate-500">
              <Building2 size={22} aria-hidden="true" />
            </span>
            <h3 className="mt-4 text-sm font-bold text-slate-900">
              {q ? "No schools match that search" : "No schools provisioned yet"}
            </h3>
            <p className="mx-auto mt-1 max-w-sm text-xs text-slate-500">
              {q
                ? "Try a different name, subdomain or contact email."
                : "Add the first school to generate its subdomain, Director account, roles and default settings."}
            </p>
            {!q && (
              <Link
                href="/super-admin/schools/new"
                className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-lg bg-teal-800 px-3 text-xs font-bold text-white hover:bg-teal-900"
              >
                <Plus size={14} aria-hidden="true" /> Add the first school
              </Link>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70 text-[10px] font-bold uppercase tracking-[.12em] text-slate-500">
                    <th scope="col" className="px-4 py-2.5 sm:px-5">School</th>
                    <th scope="col" className="px-3 py-2.5">Subdomain</th>
                    <th scope="col" className="px-3 py-2.5">Director</th>
                    <th scope="col" className="px-3 py-2.5 text-right">Learners</th>
                    <th scope="col" className="px-3 py-2.5 text-right">Accounts</th>
                    <th scope="col" className="px-3 py-2.5">Status</th>
                    <th scope="col" className="px-3 py-2.5">Settings</th>
                    <th scope="col" className="px-4 py-2.5 text-right sm:px-5">Added</th>
                  </tr>
                </thead>
                <tbody>
                  {schools.map((school) => {
                    const director = school.users[0] ?? null;
                    return (
                      <tr key={school.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
                        <td className="px-4 py-3 sm:px-5">
                          <div className="flex items-center gap-3">
                            <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-lg border border-slate-200 bg-white p-1">
                              <Image
                                src={school.logoUrl || "/mary-royal-logo.png"}
                                alt=""
                                width={80}
                                height={80}
                                className="h-full w-full object-contain"
                              />
                            </span>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-bold text-slate-900">{school.name}</p>
                              <p className="truncate text-[11px] text-slate-500">{school.id}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <a
                            href={tenantHomeUrl(school.slug)}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-semibold text-teal-800 hover:text-teal-950 hover:underline"
                          >
                            {school.slug}.school
                            <ArrowUpRight size={12} aria-hidden="true" />
                          </a>
                        </td>
                        <td className="px-3 py-3">
                          {director ? (
                            <div>
                              <p className="text-xs font-semibold text-slate-800">{director.name}</p>
                              <p className="text-[11px] text-slate-500">{director.email}</p>
                            </div>
                          ) : (
                            <span className="text-[11px] font-medium text-amber-700">No Director</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-right text-xs font-semibold text-slate-700 tabular-nums">
                          {school._count.learners.toLocaleString("en-KE")}
                        </td>
                        <td className="px-3 py-3 text-right text-xs font-semibold text-slate-700 tabular-nums">
                          {school._count.users.toLocaleString("en-KE")}
                        </td>
                        <td className="px-3 py-3">
                          <span
                            className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[.08em] ${statusClasses(school.status)}`}
                          >
                            {school.status}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <Link
                            href={`/super-admin/schools/${school.id}/payments`}
                            className="text-xs font-semibold text-teal-800 hover:underline"
                          >
                            Payment settings
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-right text-[11px] text-slate-500 sm:px-5">
                          {formatDate(school.createdAt)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 sm:px-5">
                <p className="text-[11px] text-slate-500">
                  Page {safePage} of {totalPages}
                </p>
                <div className="flex gap-2">
                  {safePage > 1 ? (
                    <Link
                      href={pageHref(safePage - 1)}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Previous
                    </Link>
                  ) : (
                    <span className="cursor-not-allowed rounded-lg border border-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-300">
                      Previous
                    </span>
                  )}
                  {safePage < totalPages ? (
                    <Link
                      href={pageHref(safePage + 1)}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Next
                    </Link>
                  ) : (
                    <span className="cursor-not-allowed rounded-lg border border-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-300">
                      Next
                    </span>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex items-center gap-2">
          <Activity size={16} className="text-teal-700" aria-hidden="true" />
          <h2 className="text-sm font-bold text-slate-950">Recent platform activity</h2>
        </div>
        {recentEvents.length === 0 ? (
          <p className="mt-3 text-xs text-slate-500">No platform events recorded yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100">
            {recentEvents.map((event) => (
              <li key={event.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-800">
                    {event.action.replaceAll("_", " ").toLowerCase()}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {event.entity}
                    {event.actorEmail ? ` · ${event.actorEmail}` : ""}
                  </p>
                </div>
                <span className="text-[11px] text-slate-400">{formatDate(event.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
