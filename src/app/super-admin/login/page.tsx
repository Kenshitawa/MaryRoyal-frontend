import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Building2, KeyRound, ShieldCheck } from "lucide-react";
import { getPlatformActor } from "@/lib/platform-auth";
import PlatformLoginForm from "./login-form";

export const metadata: Metadata = {
  title: "Platform sign in | School Core",
  robots: { index: false, follow: false },
};

export default async function PlatformLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const actor = await getPlatformActor();
  if (actor) redirect("/super-admin");

  const { next } = await searchParams;
  const nextPath = next && next.startsWith("/super-admin") ? next : "/super-admin";

  return (
    <main className="min-h-screen bg-slate-950 lg:grid lg:grid-cols-[1.05fr_.95fr]">
      <section className="relative hidden overflow-hidden bg-gradient-to-br from-teal-950 via-slate-950 to-slate-900 px-14 py-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div
          aria-hidden="true"
          className="absolute -right-32 top-10 h-[28rem] w-[28rem] rounded-full border-[60px] border-white/[.04]"
        />
        <div
          aria-hidden="true"
          className="absolute -bottom-40 left-1/3 h-[30rem] w-[30rem] rounded-full bg-teal-400/10 blur-3xl"
        />

        <Link href="/super-admin/login" className="relative z-10 flex w-fit items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/10 p-1 ring-1 ring-white/15">
            <Image src="/school-core-logo.svg" alt="" width={64} height={64} className="h-full w-full rounded-xl" />
          </span>
          <span>
            <span className="block text-sm font-extrabold uppercase tracking-[.18em]">School Core</span>
            <span className="text-[11px] tracking-[.12em] text-teal-200/80 uppercase">Platform console</span>
          </span>
        </Link>

        <div className="relative z-10 max-w-lg">
          <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-teal-100">
            <ShieldCheck size={13} /> Restricted platform access
          </p>
          <h1 className="mt-6 text-4xl font-extrabold leading-[1.1] tracking-tight xl:text-5xl">
            One platform.
            <br />
            <span className="text-teal-300">Every school.</span>
          </h1>
          <p className="mt-5 max-w-md text-sm leading-relaxed text-slate-300">
            Provision and oversee every school running the School Core template. Each school keeps its
            own data, branding and subdomain.
          </p>
          <div className="mt-8 grid gap-3 text-sm text-slate-200">
            <span className="inline-flex items-center gap-3">
              <Building2 size={17} className="text-teal-300" /> Tenant provisioning and lifecycle
            </span>
            <span className="inline-flex items-center gap-3">
              <KeyRound size={17} className="text-teal-300" /> Isolated credentials and payment settings
            </span>
            <span className="inline-flex items-center gap-3">
              <ShieldCheck size={17} className="text-teal-300" /> Append-only platform audit trail
            </span>
          </div>
        </div>

        <p className="relative z-10 text-[11px] text-slate-500">
          Authorised platform administrators only. Activity is recorded.
        </p>
      </section>

      <section className="flex min-h-screen items-center justify-center bg-slate-50 px-5 py-10 sm:px-10">
        <div className="w-full max-w-[410px]">
          <Link
            href="/"
            className="mb-8 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 transition hover:text-teal-800 lg:hidden"
          >
            <ArrowLeft size={14} /> Back to school site
          </Link>

          <div className="mb-7 flex items-center gap-3 lg:hidden">
            <Image src="/school-core-logo.svg" alt="" width={48} height={48} className="h-12 w-12 rounded-xl" />
            <div>
              <p className="text-sm font-extrabold uppercase tracking-[.16em] text-slate-900">School Core</p>
              <p className="text-[11px] uppercase tracking-[.12em] text-teal-700">Platform console</p>
            </div>
          </div>

          <p className="text-[11px] font-bold uppercase tracking-[.16em] text-teal-700">Super Admin</p>
          <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-950">Sign in to the console</h2>
          <p className="mt-2 text-sm text-slate-500">
            Use your platform administrator account. School accounts cannot sign in here.
          </p>

          <PlatformLoginForm nextPath={nextPath} />

          <p className="mt-8 border-t border-slate-200 pt-5 text-[11px] leading-relaxed text-slate-400">
            This console is separate from school portals. If you are a teacher, learner or parent, return to
            your school&apos;s own subdomain to sign in.
          </p>
        </div>
      </section>
    </main>
  );
}
