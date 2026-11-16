import { redirect } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { cookies } from "next/headers";
import { readSession } from "@/lib/session";
import {
  RiBookOpenLine,
  RiShieldCheckLine,
  RiSparklingLine,
} from "@remixicon/react";
import LoginForm from "./login-form";

export default async function Home() {
  const token = (await cookies()).get("mary_session")?.value;
  if (token) { const user = await readSession(token); if (user) redirect("/dashboard"); }
  return <main className="min-h-svh bg-background-full lg:grid lg:grid-cols-[1.02fr_.98fr]">
    <section className="relative flex min-h-60 flex-col justify-between overflow-hidden bg-gradient-to-br from-accent-950 via-accent-800 to-accent-700 px-6 pb-7 pt-6 text-text-white sm:min-h-72 sm:px-10 lg:min-h-svh lg:px-14 lg:py-10 xl:px-20">
      <div aria-hidden="true" className="absolute -right-24 top-8 size-80 rounded-full border-4 border-accent-50/10"/>
      <div aria-hidden="true" className="absolute -bottom-32 left-[42%] size-80 rounded-full bg-accent-400/20 blur-3xl"/>
      <Link href="/" className="relative z-10 flex w-fit items-center gap-3 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring">
        <span className="grid size-14 place-items-center rounded-xl bg-brand-mark-surface p-1.5 shadow-lg">
          <Image src="/mary-royal-logo.png" alt="Mary Royal School logo" width={324} height={245} priority className="size-full object-contain"/>
        </span>
        <span>
          <span className="block text-title-3-semibold">MARY ROYAL</span>
          <span className="text-caption-1-medium text-accent-100">School in Kisumu</span>
        </span>
      </Link>
      <div className="relative z-10 mt-9 max-w-xl lg:mt-0">
        <span className="inline-flex items-center gap-2 rounded-full border border-accent-100/20 bg-accent-50/10 px-3 py-1 text-caption-1-medium text-accent-50 backdrop-blur">
          <RiSparklingLine className="size-4" aria-hidden/>
          School motto: Hard work pays
        </span>
        <h1 className="mt-4 text-title-2-semibold lg:text-title-1-semibold">
          Every learner.<br/>Every possibility.
        </h1>
        <p className="mt-3 max-w-md text-body-regular text-accent-100">
          Nurturing excellence through CBE. A connected school community, built around every child’s growth.
        </p>
        <div className="mt-5 hidden items-center gap-5 text-body-2-medium text-accent-100 sm:flex">
          <span className="inline-flex items-center gap-1.5">
            <RiBookOpenLine className="size-4" aria-hidden/>
            Competency-based learning
          </span>
          <span className="inline-flex items-center gap-1.5">
            <RiShieldCheckLine className="size-4" aria-hidden/>
            Secure school access
          </span>
        </div>
      </div>
      <p className="relative z-10 mt-6 hidden text-body-2-regular text-accent-200 lg:block">
        © 2026 Mary Royal School, Obunga, Kisumu
      </p>
      <div aria-hidden="true" className="absolute bottom-0 right-0 hidden size-48 translate-x-1/3 translate-y-1/3 rounded-full border-4 border-accent-50/10 lg:block"/>
    </section>
    <section className="relative flex items-start justify-center px-5 pb-10 pt-8 sm:px-10 sm:pt-10 lg:items-center lg:px-12 xl:px-20">
      <div className="w-full max-w-md">
        <div className="mb-6 lg:mb-8">
          <p className="text-caption-1-semibold text-accent-700">Welcome to your school</p>
          <h2 className="mt-1.5 text-title-2-semibold text-text-primary">Sign in to continue</h2>
          <p className="mt-1.5 text-body-2-regular text-text-secondary">
            Use the account provided by Mary Royal School.
          </p>
        </div>
        <LoginForm/>
        <div className="mt-6 flex items-center justify-between border-t border-separator-border pt-4 text-body-2-regular text-text-tertiary">
          <span className="inline-flex items-center gap-1.5">
            <RiShieldCheckLine className="size-4 text-accent-600" aria-hidden/>
            Private school access
          </span>
          <Link href="/privacy" className="rounded-sm font-medium text-text-secondary underline-offset-4 outline-none hover:text-text-primary hover:underline focus-visible:ring-2 focus-visible:ring-border-focus-ring">
            Privacy notice
          </Link>
        </div>
        <p className="mt-6 text-center text-body-2-regular text-text-tertiary lg:hidden">
          Mary Royal School, Obunga, Kisumu
        </p>
      </div>
    </section>
  </main>;
}
