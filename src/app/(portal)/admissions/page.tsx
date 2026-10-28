import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  FilePlus2,
  Search,
  Filter,
} from "lucide-react";
import { db } from "@/lib/db";
import { can, canInScope } from "@/lib/permissions";
import { readSession } from "@/lib/session";
import { AdmissionsClient } from "./admissions-client";
import { PageHeader, StatCard } from "@/components/ui/primitives";

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
    <div className="space-y-3">
      <PageHeader
        title="Admissions"
        help="Guided admission packets, guardian checks, document vaults and admission letters."
        action={
          canCreate ? (
            <Link href="/admissions/new" className="btn btn-primary">
              <FilePlus2 size={16} aria-hidden="true" />
              <span>New admission</span>
            </Link>
          ) : undefined
        }
      />

      <section aria-label="Admission counts" className="grid grid-cols-3 gap-3">
        <StatCard label="Drafts" value={String(counts.draft)} note="Incomplete" tone="brand" />
        <StatCard label="Submitted" value={String(counts.submitted)} note="Awaiting" tone="warning" />
        <StatCard label="Enrolled" value={String(counts.enrolled)} note="Completed" tone="success" />
      </section>

      {retentionNotice ? (
        <p role="status" className="card card-pad text-label text-ink-2">{retentionNotice}</p>
      ) : null}

      <form className="card card-pad grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem_auto] sm:items-end">
        <label className="min-w-0">
          <span className="field-label">Search</span>
          <span className="relative mt-1 block">
            <Search size={16} aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
            <input name="q" defaultValue={q} maxLength={80} placeholder="Learner name or admission no." className="input input-icon" />
          </span>
        </label>
        <label>
          <span className="field-label">Status</span>
          <select name="status" defaultValue={status ?? ""} className="select mt-1">
            <option value="">All statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="SUBMITTED">Submitted</option>
            <option value="ENROLLED">Enrolled</option>
          </select>
        </label>
        <button type="submit" className="btn btn-secondary">
          <Filter size={15} aria-hidden="true" />
          <span>Apply</span>
        </button>
      </form>

      <AdmissionsClient
        initialAdmissions={admissions}
        canDelete={canDelete}
        canConfigureRetention={canConfigureRetention}
        retentionNotice={retentionNotice}
        initialRetentionDays={retentionDays}
      />
    </div>
  );
}
