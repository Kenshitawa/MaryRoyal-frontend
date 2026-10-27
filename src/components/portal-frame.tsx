import Image from "next/image";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Eye, LogOut } from "lucide-react";
import { db } from "@/lib/db";
import { readSession } from "@/lib/session";
import { ThemeStyleControls } from "@/components/design-system/theme-provider";
import PageNavigation from "@/components/page-navigation";
import NotificationBell from "@/components/notification-bell";
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
  const user = await db.user.findUnique({ where: { id: session.id }, select: { name: true, role: true, avatarUrl: true, suspended: true, forcePasswordChange: true } });
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
        <header className="sticky top-0 z-20 flex h-[68px] items-center justify-between border-b border-slate-200/75 bg-white/90 px-4 backdrop-blur-xl sm:px-7 lg:px-10 dark:bg-slate-950/90 dark:border-slate-800">
          <Link href={homeHref} aria-label="Go to your dashboard" className="flex items-center gap-2 lg:hidden">
            <Image src="/mary-royal-logo.png" alt="Mary Royal School" width={34} height={34} />
            <span className="text-sm font-extrabold">Mary Royal</span>
          </Link>
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
            <Link href="/profile" aria-label="Open profile and security settings" className="relative grid h-9 w-9 place-items-center overflow-hidden rounded-full bg-blue-100 text-xs font-bold text-blue-800 ring-1 ring-blue-200">
              {user.avatarUrl ? <Image src={user.avatarUrl} alt="" fill sizes="36px" className="object-cover" unoptimized /> : user.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase()}
            </Link>
            <form action="/api/logout" method="post">
              <button aria-label="Sign out" className="grid h-9 w-9 place-items-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900">
                <LogOut size={17} />
              </button>
            </form>
          </div>
        </header>
        <PageNavigation active={active} homeHref={homeHref} userId={session.id} />
        <div id="main-content" tabIndex={-1} className="min-h-[calc(100vh-68px)] outline-none">{children}</div>
      </div>
      <nav aria-label="Mobile navigation" className="mobile-nav fixed inset-x-0 bottom-0 z-30 flex justify-around border-t border-slate-200/80 bg-white/95 px-2 pb-[max(.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-8px_24px_rgba(15,35,70,.07)] backdrop-blur lg:hidden">
        {nav.slice(0, 4).map(({ label, href, icon: Icon }) => (
          <Link key={label} href={href} aria-current={active === label ? "page" : undefined}
            className={`flex min-h-12 min-w-16 flex-1 flex-col items-center justify-center gap-1 rounded-lg text-[10px] font-semibold ${active === label ? "text-blue-700" : "text-slate-500"}`}>
            <Icon size={18} />{label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
