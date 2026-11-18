import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { readSession } from "@/lib/session";
import ChangePasswordForm from "./change-password-form";
import Image from "next/image";
import Link from "next/link";
import { ThemeStyleControls } from "@/components/design-system/theme-provider";

export default async function Page() {
  const token = (await cookies()).get("mary_session")?.value;
  const session = token ? await readSession(token) : null;
  if (!session) redirect("/");
  const user = await db.user.findUnique({
    where: { id: session.id },
    select: { name: true, email: true, role: true, suspended: true },
  });
  if (!user || user.suspended) redirect("/");

  return (
    <>
    <a href="#main-content" className="skip-to-content sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-xl focus:bg-blue-800 focus:px-4 focus:py-3 focus:font-semibold focus:text-white">Skip to content</a>
    <main id="main-content" className="relative grid min-h-screen place-items-center bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-blue-100/60 via-slate-50 to-white p-5 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <header aria-label="Password change header" className="absolute left-5 top-5 flex items-center gap-3">
        <span className="grid size-9 place-items-center rounded-lg bg-brand-mark-surface p-1">
          <Image src="/mary-royal-logo.png" width={36} height={36} alt="Mary Royal School" className="h-full w-full object-contain" />
        </span>
        <nav aria-label="Account navigation"><Link href="/privacy" className="min-h-11 inline-flex items-center text-sm font-semibold text-blue-800 dark:text-blue-200">Privacy notice</Link></nav>
      </header>
      <div className="absolute right-5 top-5">
        <ThemeStyleControls compact />
      </div>

      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center gap-3.5">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white p-1.5 shadow-md shadow-blue-900/10 dark:bg-slate-800">
            <Image
              src="/mary-royal-logo.png"
              width={42}
              height={42}
              alt="Mary Royal School logo"
              priority
              className="object-contain"
            />
          </span>
          <div>
            <p className="font-extrabold tracking-tight text-slate-900 dark:text-white">
              Mary Royal School
            </p>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Obunga, Kisumu · First-time Setup
            </p>
          </div>
        </div>

        <section className="mb-4 rounded-2xl border border-border-button-default bg-background-primary-default p-4" aria-label="Your school account">
          <h1 className="text-title-3-semibold text-text-primary">Your school account</h1>
          <dl className="mt-2 grid gap-2 text-body-2-regular sm:grid-cols-2">
            <div><dt className="text-text-tertiary">Name</dt><dd className="text-text-primary">{user.name}</dd></div>
            <div><dt className="text-text-tertiary">Sign-in email</dt><dd className="break-all text-text-primary">{user.email}</dd></div>
            <div><dt className="text-text-tertiary">Role</dt><dd className="text-text-primary">{user.role.replaceAll("_", " ")}</dd></div>
          </dl>
          <p className="mt-2 text-body-2-regular text-text-secondary">This is your account. Set a personal password below to finish setup.</p>
        </section>
        <ChangePasswordForm />
      </div>
    </main>
    </>
  );
}
