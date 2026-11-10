import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getPlatformActor } from "@/lib/platform-auth";
import PlatformNav from "./platform-nav";
import PlatformSignOut from "./platform-sign-out";

export const metadata: Metadata = {
  title: "Platform console | School Core",
  robots: { index: false, follow: false },
};

export default async function PlatformConsoleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const actor = await getPlatformActor();
  if (!actor) redirect("/super-admin/login");

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-950 text-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
          <Link href="/super-admin" className="flex min-w-0 items-center gap-3">
            <Image
              src="/school-core-logo.svg"
              alt=""
              width={40}
              height={40}
              className="h-10 w-10 shrink-0 rounded-xl"
            />
            <span className="min-w-0">
              <span className="block truncate text-sm font-extrabold uppercase tracking-[.16em]">
                School Core
              </span>
              <span className="block text-[10px] uppercase tracking-[.16em] text-teal-300/80">
                Platform console
              </span>
            </span>
          </Link>

          <div className="ml-auto flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-xs font-semibold text-white">{actor.name}</p>
              <p className="text-[10px] text-slate-400">{actor.email}</p>
            </div>
            <PlatformSignOut />
          </div>
        </div>
        <div className="mx-auto flex max-w-7xl items-center gap-1 px-4 sm:px-6 lg:px-8">
          <PlatformNav />
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 py-7 sm:px-6 sm:py-9 lg:px-8">{children}</main>

      <footer className="mx-auto max-w-7xl px-4 pb-8 text-[11px] text-slate-500 sm:px-6 lg:px-8">
        School Core platform administration · Actions are audited · Not a school portal
      </footer>
    </div>
  );
}
