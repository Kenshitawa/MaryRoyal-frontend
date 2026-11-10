import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Building2, ExternalLink, ShieldCheck } from "lucide-react";
import PaymentSettingsForm from "@/components/payment-settings-form";
import { db } from "@/lib/db";
import { getPlatformActor } from "@/lib/platform-auth";
import { toPaymentSettingsView } from "@/lib/payment-settings";
import { tenantHomeUrl } from "@/lib/tenant-host";

export const dynamic = "force-dynamic";

export default async function PlatformSchoolPaymentsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await getPlatformActor();
  if (!actor) notFound();

  const { id } = await params;
  const school = await db.school.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
      logoUrl: true,
      paymentConfig: true,
    },
  });
  if (!school) notFound();

  const settings = toPaymentSettingsView(school.id, school.paymentConfig);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/super-admin"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 transition hover:text-teal-800"
        >
          <ArrowLeft size={14} aria-hidden="true" /> Back to schools
        </Link>
        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5">
              <Image
                src={school.logoUrl || "/mary-royal-logo.png"}
                alt=""
                width={96}
                height={96}
                className="h-full w-full object-contain"
              />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[.16em] text-teal-700">
                Tenant payment settings
              </p>
              <h1 className="mt-1 truncate text-2xl font-extrabold tracking-tight text-slate-950 sm:text-3xl">
                {school.name}
              </h1>
              <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1">
                  <Building2 size={13} aria-hidden="true" /> {school.slug}
                </span>
                <span aria-hidden="true">·</span>
                <span
                  className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                    school.status === "ACTIVE"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-amber-200 bg-amber-50 text-amber-700"
                  }`}
                >
                  {school.status}
                </span>
                <a
                  href={tenantHomeUrl(school.slug)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 font-semibold text-teal-800 hover:underline"
                >
                  Open subdomain <ExternalLink size={12} aria-hidden="true" />
                </a>
              </p>
            </div>
          </div>
        </div>
        <p className="mt-4 max-w-3xl text-sm leading-relaxed text-slate-500">
          These settings appear only in this school&apos;s portal. Daraja credentials are encrypted
          before storage; this console and the school API only receive masked values. The school&apos;s
          Director and Accountant can also manage these settings from their own portal.
        </p>
      </div>

      <div className="rounded-2xl border border-teal-200 bg-teal-50/70 p-4">
        <p className="flex items-start gap-2 text-xs font-semibold leading-relaxed text-teal-900">
          <ShieldCheck size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          Platform changes are recorded in both the platform audit trail and the school&apos;s audit
          trail. Secret values are never included in either record.
        </p>
      </div>

      <PaymentSettingsForm
        initial={settings}
        endpoint={`/api/super-admin/schools/${school.id}/payment-settings`}
        canEdit
      />
    </div>
  );
}
