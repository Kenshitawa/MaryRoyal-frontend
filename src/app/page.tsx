import { redirect } from "next/navigation";
import Image from "next/image";
import { cookies } from "next/headers";
import { readSession } from "@/lib/session";
import { RiBookOpenLine, RiShieldCheckLine, RiSparkling2Line } from "@remixicon/react";
import LoginForm from "./login-form";
import Link from "next/link";

export default async function Home() {
  const token = (await cookies()).get("mary_session")?.value;
  if (token) {
    const user = await readSession(token);
    if (user) redirect("/dashboard");
  }

  return (
    <main className="min-h-screen bg-background-full text-text-primary lg:grid lg:grid-cols-2">
      <section className="relative flex min-h-60 flex-col justify-between overflow-hidden bg-linear-to-br from-accent-950 via-accent-800 to-accent-700 px-5 py-5 text-text-white sm:min-h-72 sm:px-8 sm:py-7 lg:min-h-screen lg:px-14 lg:py-10 xl:px-20">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-16 -top-20 size-64 rounded-full border-8 border-text-white/10"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-16 left-1/3 size-48 rounded-full bg-accent-400/20 blur-3xl"
        />

        <div className="relative z-10 flex w-fit items-center gap-3">
          <span className="grid size-12 place-items-center rounded-xl bg-text-white p-1.5 shadow-lg sm:size-14">
            <Image
              src="/mary-royal-logo.png"
              alt="Mary Royal School crest"
              width={324}
              height={245}
              priority
              className="h-full w-full object-contain"
            />
          </span>
          <span>
            <span className="block text-body-bold tracking-[0.13em]">MARY ROYAL</span>
            <span className="text-caption-2-medium tracking-[0.16em] text-accent-100">SCHOOL · KISUMU</span>
          </span>
        </div>

        <div className="relative z-10 mt-7 max-w-xl lg:my-auto">
          <span className="inline-flex items-center gap-2 rounded-full border border-text-white/15 bg-text-white/10 px-3 py-1 text-caption-2-semibold text-accent-50">
            <RiSparkling2Line className="size-4" aria-hidden />
            School motto · Hard work pays
          </span>
          <h1 className="mt-4 text-title-1-semibold leading-tight sm:text-display-4-medium">
            Every learner.
            <br />
            <span className="text-accent-100">Every possibility.</span>
          </h1>
          <p className="mt-3 max-w-md text-body-regular text-accent-50">
            Nurturing Excellence Through CBE. A connected school community, built around every child&apos;s growth.
          </p>
          <div className="mt-5 hidden flex-wrap items-center gap-x-5 gap-y-2 text-caption-1-medium text-accent-100 sm:flex">
            <span className="inline-flex items-center gap-1.5">
              <RiBookOpenLine className="size-4" aria-hidden />
              Competency-based learning
            </span>
            <span className="inline-flex items-center gap-1.5">
              <RiShieldCheckLine className="size-4" aria-hidden />
              Secure school access
            </span>
          </div>
        </div>

        <p className="relative z-10 mt-6 hidden text-caption-2-regular text-accent-100 lg:block">
          © {new Date().getFullYear()} Mary Royal School · Obunga, Kisumu
        </p>
      </section>

      <section className="flex items-center justify-center bg-background-full px-4 py-8 sm:px-8 sm:py-10 lg:px-12 xl:px-20">
        <div className="w-full max-w-md">
          <div className="rounded-3xl border border-border-button-default bg-background-primary-default p-5 shadow-lg sm:p-8">
            <div className="mb-6">
              <p className="text-caption-1-semibold uppercase tracking-[0.12em] text-accent-700">
                Welcome to your school
              </p>
              <h2 className="mt-1.5 text-title-1-semibold">Sign in to continue</h2>
              <p className="mt-1.5 text-body-2-regular text-text-secondary">
                Use the account provided by Mary Royal School.
              </p>
            </div>

            <LoginForm />

            <div className="mt-6 flex items-center justify-between gap-3 border-t border-separator-border pt-4">
              <span className="inline-flex items-center gap-1.5 text-caption-2-medium text-text-secondary">
                <RiShieldCheckLine className="size-4 text-accent-700" aria-hidden />
                Private school access
              </span>
              <Link
                href="/privacy"
                className="text-caption-2-semibold text-text-secondary underline-offset-4 hover:text-accent-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring"
              >
                Privacy notice
              </Link>
            </div>
          </div>

          <p className="mt-5 text-center text-caption-2-regular text-text-tertiary lg:hidden">
            Mary Royal School · Obunga, Kisumu
          </p>
        </div>
      </section>
    </main>
  );
}
