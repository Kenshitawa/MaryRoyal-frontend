import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  ClipboardList,
  FilePlus2,
  Search,
  FileCheck2,
  Clock,
  CheckCircle2,
  Filter,
} from "lucide-react";
import PortalFrame from "@/components/portal-frame";
import { db } from "@/lib/db";
import { can, canInScope } from "@/lib/permissions";
import { readSession } from "@/lib/session";
import { AdmissionsClient } from "./admissions-client";

export default async function AdmissionsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const token = (await cookies()).get("mary_session")?.value;
  const session = token ? await readSession(token) : null;
  if (!session) redirect("/");

  const user = await db.user.findUnique({
    where: { id: session.id },
    select: { id: true, role: true, suspended: true, forcePasswordChange: true },
  });
  if (!user || user.suspended) redirect("/");
  if (user.forcePasswordChange) redirect("/change-password");
  if (!canInScope(user.role, "admissions", "view", "school")) redirect("/dashboard");

  const params = await searchParams;
  const q = params.q?.trim().slice(0, 80) ?? "";
  const status = ["DRAFT", "SUBMITTED", "ENROLLED"].includes(params.status ?? "")
    ? params.status
    : undefined;

  const admissions = await db.admissionDraft.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(q
        ? {
            OR: [
              { admissionNo: { contains: q } },
              { learner: { name: { contains: q } } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      admissionNo: true,
      status: true,
      currentStep: true,
      updatedAt: true,
      submittedAt: true,
      learner: { select: { id: true, name: true, grade: true } },
      documents: { select: { category: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });

  const canCreate = canInScope(user.role, "admissions", "create", "school");
  const canDelete = can(user.role, "admissions", "delete");
  const canConfigureRetention = user.role === "DIRECTOR" || user.role === "HEAD_TEACHER";

  const retentionSetting = await db.schoolSetting.findUnique({
    where: { key: "draft_retention_days" },
  });
  const retentionDays = retentionSetting ? parseInt(retentionSetting.value, 10) || 0 : 0;
  const retentionNotice =
    retentionDays > 0
      ? `Notice: Inactive admission drafts untouched for more than ${retentionDays} days are scheduled for automatic purge.`
      : null;

  const counts = {
    draft: admissions.filter((row) => row.status === "DRAFT").length,
    submitted: admissions.filter((row) => row.status === "SUBMITTED").length,
    enrolled: admissions.filter((row) => row.status === "ENROLLED").length,
  };

  return (
    <PortalFrame active="Admissions">
      <section className="mx-auto max-w-7xl space-y-6 p-4 pb-28 sm:p-6 lg:p-8">
        {/* Header Hero */}
        <div className="bento-card overflow-hidden rounded-3xl border border-blue-100 bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-900 p-6 text-white shadow-xl shadow-blue-950/10 sm:p-8 dark:border-blue-900/50">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-400/20 px-3 py-1 text-xs font-bold text-blue-200 ring-1 ring-inset ring-blue-300/30">
                <FileCheck2 size={14} className="text-blue-300" />
                Admissions Desk · Mary Royal School
              </span>
              <h1 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">
                Learner Admissions &amp; Enrollment
              </h1>
              <p className="mt-1 text-xs text-blue-100 sm:text-sm">
                7-step guided admission packets, guardian verification, document vaults, and official admission letters.
              </p>
            </div>

            {canCreate && (
              <Link
                href="/admissions/new"
                className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-xs font-bold text-blue-900 shadow-lg shadow-blue-950/20 transition hover:bg-blue-50"
              >
                <FilePlus2 size={16} />
                Start New Admission
              </Link>
            )}
          </div>
        </div>

        {/* Bento Metric Cards */}
        <section className="grid gap-4 sm:grid-cols-3" aria-label="Admission counts">
          <div className="bento-card flex items-center justify-between rounded-2xl border border-slate-200/90 bg-white/95 p-5 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
            <div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Incomplete Drafts</p>
              <p className="mt-1 text-2xl font-black text-slate-900 dark:text-white">{counts.draft}</p>
            </div>
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
              <Clock size={18} />
            </span>
          </div>

          <div className="bento-card flex items-center justify-between rounded-2xl border border-slate-200/90 bg-white/95 p-5 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
            <div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Submitted for Approval</p>
              <p className="mt-1 text-2xl font-black text-amber-600 dark:text-amber-400">{counts.submitted}</p>
            </div>
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
              <ClipboardList size={18} />
            </span>
          </div>

          <div className="bento-card flex items-center justify-between rounded-2xl border border-slate-200/90 bg-white/95 p-5 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
            <div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Enrolled Learners</p>
              <p className="mt-1 text-2xl font-black text-emerald-600 dark:text-emerald-400">{counts.enrolled}</p>
            </div>
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
              <CheckCircle2 size={18} />
            </span>
          </div>
        </section>

        {/* Filter Controls */}
        <form className="bento-card flex flex-col gap-3 rounded-2xl border border-slate-200/90 bg-white/95 p-4 shadow-sm backdrop-blur sm:flex-row sm:items-end dark:border-slate-800 dark:bg-slate-900/90">
          <label className="flex-1 text-xs font-bold text-slate-700 dark:text-slate-300">
            Search by learner or admission number
            <div className="relative mt-1.5">
              <Search
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                name="q"
                defaultValue={q}
                maxLength={80}
                placeholder="e.g. MR-12 or Achieng"
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-4 text-xs font-medium text-slate-900 outline-none transition focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:border-blue-500"
              />
            </div>
          </label>

          <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
            Status
            <select
              name="status"
              defaultValue={status ?? ""}
              className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 text-xs font-medium text-slate-900 outline-none transition focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-100 sm:w-52 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:border-blue-500"
            >
              <option value="">All statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="SUBMITTED">Submitted</option>
              <option value="ENROLLED">Enrolled</option>
            </select>
          </label>

          <button
            type="submit"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 text-xs font-bold text-white shadow-sm transition hover:bg-blue-800"
          >
            <Filter size={14} />
            Apply Filters
          </button>
        </form>

        {/* Interactive Admissions Client Table & Actions */}
        <AdmissionsClient
          initialAdmissions={admissions}
          canDelete={canDelete}
          canConfigureRetention={canConfigureRetention}
          retentionNotice={retentionNotice}
          initialRetentionDays={retentionDays}
        />
      </section>
    </PortalFrame>
  );
}
