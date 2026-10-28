import Image from "next/image";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Eye } from "lucide-react";
import { db } from "@/lib/db";
import { readSession } from "@/lib/session";
import { ThemeStyleControls } from "@/components/design-system/theme-provider";
import PageNavigation from "@/components/page-navigation";
import NotificationBell from "@/components/notification-bell";
import MobileNav from "@/components/mobile-nav";
import MobileHeader from "@/components/mobile-header";
import ConfirmLogoutForm from "@/components/confirm-logout-form";
import { getRoleNavigation } from "@/lib/navigation";

const roleTitle: Record<string, string> = {
  DIRECTOR: "Director",
  HEAD_TEACHER: "Head Teacher",
  DEPUTY: "Deputy Head Teacher",
  SECRETARY: "Secretary",
  ACCOUNTANT: "Accountant",
  TEACHER: "Teacher",
  WELFARE_CHAIR: "Welfare Chair",
  NON_TEACHING_STAFF: "Non-Teaching Staff",
  PARENT: "Parent",
  LEARNER: "Learner",
};
export default async function PortalFrame({ children, active }: { children: React.ReactNode; active: string }) {
  const token = (await cookies()).get("mary_session")?.value;
  const session = token ? await readSession(token) : null;
  if (!session) redirect("/");
  const user = await db.user.findUnique({ where: { id: session.id }, select: { name: true, email: true, role: true, avatarUrl: true, suspended: true, forcePasswordChange: true } });
  if (!user || user.suspended) redirect("/");
  if (user.forcePasswordChange) redirect("/change-password");
  let nav = getRoleNavigation(user.role);
  if (user.role === "TEACHER") {
    const classTeacher = await db.classTeacherAssignment.findFirst({ where: { teacherId: session.id }, select: { id: true } });
    if (!classTeacher) nav = nav.filter((item) => item.label !== "Attendance");
  }
  const homeHref = user.role === "PARENT" ? "/portal" : user.role === "LEARNER" ? "/learning" : user.role === "NON_TEACHING_STAFF" || user.role === "WELFARE_CHAIR" ? "/welfare" : "/dashboard";
  return (
    <div className="min-h-screen lg:flex">
      <a href="#main-content" className="sr-only fixed left-4 top-4 z-[60] rounded-xl bg-blue-800 px-4 py-3 font-semibold text-white focus:not-sr-only focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-blue-300">Skip to main content</a>
      <aside className="school-sidebar fixed inset-y-0 left-0 z-30 hidden h-screen w-[250px] shrink-0 flex-col overflow-y-auto border-r border-slate-200/80 bg-[#f1f6ff] px-4 py-6 lg:flex dark:bg-slate-950 dark:border-slate-800">
        <Link href={homeHref} className="mb-9 flex items-center gap-3 px-2">
          <Image src="/mary-royal-logo.png" alt="Mary Royal School home" width={42} height={42} />
          <span><b className="block text-sm tracking-tight text-slate-900 dark:text-white">Mary Royal School</b><span className="text-[10px] text-slate-500">Obunga · Kisumu</span></span>
        </Link>
        <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[.16em] text-slate-400">Workspace</p>
        <nav aria-label="Main navigation" className="space-y-1">
          {nav.map(({ label, href, icon: Icon }) => (
            <Link key={label} href={href} aria-current={active === label ? "page" : undefined}
              className={`flex items-center gap-3 rounded-xl px-3 py-3 text-[13px] font-semibold transition ${active === label ? "bg-blue-50 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" : "text-slate-600 hover:bg-slate-50 hover:text-blue-700 dark:text-slate-400 dark:hover:bg-slate-800"}`}>
              <Icon size={18} />{label}{active === label && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-blue-600" />}
            </Link>
          ))}
        </nav>
        <div className="mt-auto rounded-2xl bg-gradient-to-br from-blue-800 to-blue-600 p-4 text-white">
          <p className="text-sm font-bold">Hard work pays</p>
          <p className="mt-1 text-xs leading-relaxed text-white">Nurturing Excellence Through CBE</p>
        </div>
      </aside>
      <div className="min-w-0 flex-1 lg:ml-[250px]">
        <header className="sticky top-0 z-20 hidden h-[68px] items-center justify-between border-b border-slate-200/75 bg-white px-4 sm:px-7 lg:flex lg:px-10 dark:bg-slate-950 dark:border-slate-800">
          <div className="hidden text-xs text-slate-500 lg:block">
            Mary Royal School <span className="mx-2 text-slate-300">/</span><span className="font-semibold text-slate-700 dark:text-slate-300">{active}</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <ThemeStyleControls compact />
            <NotificationBell />
            {user.role === "DIRECTOR" && (
              <Link href="/audit" aria-label="Security activity" title="Security activity" className="grid h-9 w-9 place-items-center rounded-xl text-blue-800 transition hover:bg-blue-50">
                <Eye size={17} />
              </Link>
            )}
            <span className="hidden text-right sm:block">
              <span className="block text-xs font-bold text-slate-800 dark:text-white">{user.name}</span>
              <span className="text-[10px] text-slate-500">{roleTitle[user.role] ?? user.role}</span>
            </span>
            <details className="relative">
              <summary aria-label="Open profile menu" className="relative grid h-10 w-10 cursor-pointer list-none place-items-center overflow-hidden rounded-full bg-blue-100 text-xs font-bold text-blue-800 ring-1 ring-blue-200 dark:bg-blue-950 dark:text-blue-100 dark:ring-blue-800">
                {user.avatarUrl ? <Image src={user.avatarUrl} alt="" fill sizes="40px" className="object-cover" unoptimized /> : user.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase()}
              </summary>
              <div className="absolute right-0 top-12 z-50 w-64 rounded-2xl border border-slate-200 bg-white p-3 text-slate-900 shadow-xl dark:border-slate-700 dark:bg-slate-900 dark:text-white">
                <p className="truncate text-sm font-semibold">{user.name}</p><p className="truncate text-xs text-slate-600 dark:text-slate-300">{user.email}</p>
                <Link href="/profile" className="mt-3 flex min-h-11 items-center rounded-xl px-3 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800">Profile & password</Link>
                <ConfirmLogoutForm className="mt-2 border-t border-slate-200 pt-2 dark:border-slate-700" buttonClassName="min-h-11 w-full rounded-xl px-3 text-left text-sm font-semibold text-rose-700 hover:bg-rose-50 dark:text-rose-200 dark:hover:bg-rose-950/40" />
              </div>
            </details>
          </div>
        </header>
        <MobileHeader active={active} homeHref={homeHref} user={{ name: user.name, email: user.email, role: user.role, roleLabel: roleTitle[user.role] ?? user.role, avatarUrl: user.avatarUrl }} />
        <PageNavigation active={active} homeHref={homeHref} userId={session.id} />
        <main id="main-content" tabIndex={-1} className="min-h-[calc(100vh-68px)] outline-none pb-20 lg:pb-0">{children}</main>
      </div>
      <MobileNav
        role={user.role}
        active={active}
        user={{ name: user.name, role: user.role, avatarUrl: user.avatarUrl }}
      />
    </div>
  );
}
