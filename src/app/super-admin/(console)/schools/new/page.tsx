import Link from "next/link";
import { ArrowLeft, Building2, ImageUp, Palette, ShieldCheck, UserRound } from "lucide-react";
import AddSchoolForm from "./add-school-form";

export const dynamic = "force-dynamic";

const steps = [
  { icon: Building2, title: "Tenant row", body: "School identity, subdomain and contact details" },
  { icon: Palette, title: "Template copy", body: "CBC levels, counters and default school settings" },
  { icon: UserRound, title: "First Director", body: "A temporary password shown once to the Super Admin" },
  { icon: ShieldCheck, title: "Isolation", body: "Every record is stamped with the new school_id" },
];

export default function AddSchoolPage() {
  return (
    <div className="space-y-7">
      <div>
        <Link
          href="/super-admin"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 transition hover:text-teal-800"
        >
          <ArrowLeft size={14} aria-hidden="true" /> Back to schools
        </Link>
        <p className="mt-4 text-[11px] font-bold uppercase tracking-[.16em] text-teal-700">Provisioning</p>
        <h1 className="mt-1.5 text-2xl font-extrabold tracking-tight text-slate-950 sm:text-3xl">
          Add a school
        </h1>
        <p className="mt-1.5 max-w-2xl text-sm text-slate-500">
          This creates an identical copy of the School Core template on its own subdomain. Features, roles,
          pages and behaviour stay the same — only the school&apos;s data and branding differ.
        </p>
      </div>

      <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((step, index) => {
          const Icon = step.icon;
          return (
            <li key={step.title} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
              <div className="flex items-center gap-2">
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-teal-50 text-teal-700">
                  <Icon size={14} aria-hidden="true" />
                </span>
                <span className="text-[10px] font-bold uppercase tracking-[.12em] text-slate-400">
                  Step {index + 1}
                </span>
              </div>
              <p className="mt-2 text-xs font-bold text-slate-900">{step.title}</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">{step.body}</p>
            </li>
          );
        })}
      </ol>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_290px] lg:items-start">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <AddSchoolForm rootDomain={process.env.PLATFORM_ROOT_DOMAIN ?? null} />
        </section>

        <aside className="space-y-3">
          <div className="rounded-2xl border border-teal-200 bg-teal-50/70 p-4">
            <div className="flex items-center gap-2 text-teal-900">
              <ImageUp size={16} aria-hidden="true" />
              <h2 className="text-sm font-bold">Logo guidance</h2>
            </div>
            <ul className="mt-2.5 space-y-2 text-[11px] leading-relaxed text-teal-900/80">
              <li>PNG, JPEG or WebP; 2 MB maximum.</li>
              <li>Square or near-square artwork works best.</li>
              <li>At least 32 × 32 px; stored as an optimised WebP up to 512 px.</li>
              <li>The logo is served from the school&apos;s own subdomain.</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-bold text-slate-900">What is created</h2>
            <ul className="mt-2.5 space-y-1.5 text-[11px] leading-relaxed text-slate-500">
              <li>• Active school row with a unique subdomain</li>
              <li>• Blank payment settings ready for Phase 6</li>
              <li>• CBC levels, admission and receipt counters</li>
              <li>• School profile and academic setup defaults</li>
              <li>• First Director account with force-password-change</li>
              <li>• School and platform audit entries</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <h2 className="text-sm font-bold text-amber-900">Shown once</h2>
            <p className="mt-1.5 text-[11px] leading-relaxed text-amber-900/80">
              The Director&apos;s temporary password is returned only after the first successful request. It is
              never stored in plain text, logged or emailed. Copy it before leaving the confirmation screen.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
