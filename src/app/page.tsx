import { redirect } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { cookies, headers } from "next/headers";
import { readSession } from "@/lib/session";
import { getTenantConfig } from "@/lib/tenant";
import { DEMO_FALLBACK_TENANT } from "@/lib/tenant-types";
import { BookOpenCheck, ShieldCheck, Sparkles } from "lucide-react";
import LoginForm from "./login-form";

export default async function Home() {
  const cookieStore = await cookies();
  const token = cookieStore.get("school_session")?.value;
  if (token) {
    const user = await readSession(token);
    if (user) redirect("/dashboard");
  }

  const reqHeaders = await headers();
  const schoolSlug = reqHeaders.get("x-school-slug");
  const tenant = (schoolSlug ? await getTenantConfig(schoolSlug) : null) ?? DEMO_FALLBACK_TENANT;

  const locationSnippet = tenant.physicalAddress ?? "Obunga, Kisumu";

  return (
    <main className="min-h-screen bg-white lg:grid lg:grid-cols-[1.02fr_.98fr]">
      <section
        style={{
          background: `linear-gradient(135deg, ${tenant.secondaryColour} 0%, #16418b 50%, ${tenant.primaryColour} 100%)`,
        }}
        className="relative flex min-h-[245px] flex-col justify-between overflow-hidden px-6 pb-7 pt-6 text-white sm:min-h-[300px] sm:px-10 lg:min-h-screen lg:px-14 lg:py-10 xl:px-20"
      >
        <div aria-hidden="true" className="absolute -right-24 top-8 h-80 w-80 rounded-full border-[45px] border-white/[.06]" />
        <div aria-hidden="true" className="absolute -bottom-32 left-[42%] h-80 w-80 rounded-full bg-blue-400/20 blur-3xl" />
        <Link href="/" className="relative z-10 flex w-fit items-center gap-3">
          <span className="grid h-14 w-14 place-items-center rounded-xl bg-white p-1.5 shadow-lg shadow-blue-950/20">
            <Image
              src={tenant.logoUrl || "/mary-royal-logo.png"}
              alt={`${tenant.name} logo`}
              width={324}
              height={245}
              priority
              className="h-full w-full object-contain"
            />
          </span>
          <span>
            <span className="block text-sm font-extrabold tracking-[.13em] uppercase">{tenant.name}</span>
            <span className="text-[10px] font-medium tracking-[.2em] text-blue-100 uppercase">{locationSnippet}</span>
          </span>
        </Link>
        <div className="relative z-10 mt-9 max-w-xl lg:mt-0">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[11px] font-semibold text-blue-50 backdrop-blur">
            <Sparkles size={13} /> School motto Â· {tenant.motto}
          </span>
          <h1 className="mt-5 text-[32px] font-extrabold leading-[1.12] tracking-tight sm:text-4xl lg:text-5xl xl:text-[58px]">
            Every learner.
            <br />
            <span className="text-blue-200">Every possibility.</span>
          </h1>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-blue-100 sm:text-base">
            {tenant.slogan ?? "Nurturing Excellence Through CBE"}. A connected school community, built around every childâ€™s growth.
          </p>
          <div className="mt-6 hidden items-center gap-5 text-xs font-medium text-blue-100 sm:flex">
            <span className="inline-flex items-center gap-2">
              <BookOpenCheck size={16} /> Competency-based learning
            </span>
            <span className="inline-flex items-center gap-2">
              <ShieldCheck size={16} /> Secure school access
            </span>
          </div>
        </div>
        <p className="relative z-10 mt-6 hidden text-[11px] text-blue-200 lg:block">
          Â© {new Date().getFullYear()} {tenant.name} Â· {locationSnippet}
        </p>
        <div aria-hidden="true" className="absolute bottom-0 right-0 hidden h-48 w-48 translate-x-1/3 translate-y-1/3 rounded-full border-[28px] border-white/[.06] lg:block" />
      </section>
      <section className="relative flex items-start justify-center px-5 pb-10 pt-8 sm:px-10 sm:pt-10 lg:items-center lg:px-12 xl:px-20">
        <div className="w-full max-w-[420px]">
          <div className="mb-7 lg:mb-9">
            <p className="text-xs font-bold uppercase tracking-[.16em] text-blue-700">Welcome to your school</p>
            <h2 className="mt-2 text-[30px] font-extrabold tracking-tight text-slate-950 sm:text-3xl">Sign in to continue</h2>
            <p className="mt-2 text-sm text-slate-500">Use the account provided by {tenant.name}.</p>
          </div>
          <LoginForm />
          <div className="mt-7 flex items-center justify-between border-t border-slate-100 pt-5 text-[11px] text-slate-400">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-blue-600" /> Private school access
            </span>
            <Link href="/privacy" className="font-semibold text-slate-500 underline-offset-4 hover:text-blue-700 hover:underline">
              Privacy notice
            </Link>
          </div>
          <p className="mt-7 text-center text-[10px] text-slate-400 lg:hidden">
            {tenant.name} Â· {locationSnippet}
          </p>
        </div>
      </section>
    </main>
  );
}
