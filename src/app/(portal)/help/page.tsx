import Link from "next/link";
import {
  BarChart3,
  CalendarCheck,
  CircleDollarSign,
  ClipboardCheck,
  GraduationCap,
  HelpCircle,
  KeyRound,
  Search,
  ShieldCheck,
  Sparkles,
  UserRound,
  Users,
  Wallet,
} from "lucide-react";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { readSession } from "@/lib/session";
import { PageHeader } from "@/components/ui/primitives";

const guides = [
  {
    title: "Find any page",
    icon: Search,
    tone: "bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300",
    body: "Use Search in the top bar on desktop, or More → Find a page on mobile. Type a page name or a learner or staff name to jump straight there.",
  },
  {
    title: "Dashboard & quick actions",
    icon: BarChart3,
    tone: "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300",
    body: "Your dashboard shows live totals, attendance and fee trends, coloured quick actions and the latest three school activities. Use View all to open the full audit list.",
  },
  {
    title: "Fees & balances",
    icon: Wallet,
    tone: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300",
    body: "Open Finance for invoices, recorded payments, receipts and balances. Outstanding totals only count confirmed payments, so draft or reversed entries do not reduce a balance.",
  },
  {
    title: "Attendance",
    icon: CalendarCheck,
    tone: "bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300",
    body: "Class teachers mark the register from Attendance. The dashboard trend uses the most recently marked days, so a day without a register is shown as a gap — never as zero.",
  },
  {
    title: "Learners & admissions",
    icon: GraduationCap,
    tone: "bg-violet-50 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300",
    body: "Admissions holds applications waiting for review. Approved learners move to the Learners register, where profiles, guardians and fee balances are kept together.",
  },
  {
    title: "Assessments",
    icon: ClipboardCheck,
    tone: "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300",
    body: "Teachers enter marks and submit them for review. The Head Teacher reviews, and the Director releases results to families. Draft marks stay private until released.",
  },
  {
    title: "Staff & accounts",
    icon: Users,
    tone: "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300",
    body: "The Director provisions accounts and controls roles. The staff directory is limited to authorised leaders; every staff member can open their own profile and password page.",
  },
  {
    title: "Reset keys & security",
    icon: KeyRound,
    tone: "bg-orange-50 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300",
    body: "On Accounts, Reset Key replaces the action buttons with the new credential. Tap the key to select it or use Copy. The notice clears after copying, and the old key stops working immediately.",
  },
];

const learnerGuides = [
  {
    title: "Finish classwork",
    icon: ClipboardCheck,
    tone: "bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300",
    body: "Open Classwork to read your teacher’s instructions, write an answer or attach a photo, then submit it for review.",
  },
  {
    title: "Check released results",
    icon: GraduationCap,
    tone: "bg-violet-50 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300",
    body: "Your Learning page shows official marks after the school releases them. Draft marks are not shown here.",
  },
  {
    title: "See your attendance",
    icon: CalendarCheck,
    tone: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300",
    body: "Open Attendance to see your recent classroom record and the days marked present, absent or late.",
  },
  {
    title: "Practise and ask for help",
    icon: Sparkles,
    tone: "bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300",
    body: "Try a short practice challenge on Learning, or ask the private assistant about your own school records.",
  },
];

export default async function HelpPage() {
  const token = (await cookies()).get("mary_session")?.value;
  const session = token ? await readSession(token) : null;
  const user = session
    ? await db.user.findUnique({ where: { id: session.id }, select: { role: true } })
    : null;
  const isLearner = user?.role === "LEARNER";
  const home = user?.role === "PARENT" ? "/portal" : isLearner ? "/learning" : "/dashboard";
  const canAsk = user && user.role !== "PARENT" && user.role !== "LEARNER";
  const visibleGuides = isLearner ? learnerGuides : guides;

  return (
    <section className={`mx-auto max-w-5xl space-y-3 p-4 pb-28 md:p-8 ${isLearner ? "learner-help" : ""}`}>
      <PageHeader
        title={isLearner ? "Help with learning" : "Help & guides"}
        help={isLearner ? "Quick answers for classwork, results and your account." : "Short, practical answers for the tasks staff and families use most. Everything here works in light and dark mode."}
      />

      {canAsk || isLearner ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-blue-200/80 bg-gradient-to-r from-blue-50 via-white to-indigo-50 p-4 dark:border-blue-900/60 dark:from-blue-950/40 dark:via-slate-900 dark:to-indigo-950/30 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-sm">
              <Sparkles size={18} aria-hidden="true" />
            </span>
            <div>
              <p className="text-body font-bold text-ink">{isLearner ? "Ask your learning helper" : "Ask the assistant"}</p>
              <p className="text-label text-ink-2">{isLearner ? "Get help with your own marks, attendance or classwork." : "Get a live answer about fees, attendance or pending work without opening each page."}</p>
            </div>
          </div>
          <Link href="/assistant" className="btn btn-primary btn-sm shrink-0">
            {isLearner ? "Ask a question" : "Ask me anything"}
          </Link>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        {visibleGuides.map((guide) => {
          const Icon = guide.icon;
          return (
            <article key={guide.title} className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
              <div className="flex items-center gap-2.5">
                <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${guide.tone}`}>
                  <Icon size={17} aria-hidden="true" />
                </span>
                <h2 className="text-body font-bold text-ink">{guide.title}</h2>
              </div>
              <p className="mt-2.5 text-label leading-relaxed text-ink-2">{guide.body}</p>
            </article>
          );
        })}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <article className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
              <UserRound size={17} aria-hidden="true" />
            </span>
            <h2 className="text-body font-bold text-ink">Your profile</h2>
          </div>
          <p className="mt-2.5 text-label leading-relaxed text-ink-2">
            Open your profile menu to see your photo and role, change the colour mode with one tap, update your password or sign out safely.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href="/profile" className="btn btn-secondary btn-sm">
              Profile & password
            </Link>
            <Link href={home} className="btn btn-quiet btn-sm">
              Back to home
            </Link>
          </div>
        </article>

        <article className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
              <ShieldCheck size={17} aria-hidden="true" />
            </span>
            <h2 className="text-body font-bold text-ink">Privacy & safe use</h2>
          </div>
          <p className="mt-2.5 text-label leading-relaxed text-ink-2">
            Never share a reset key in a public chat. Sign out on shared devices, and ask the school office before sending sensitive learner information outside the portal.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href="/privacy" className="btn btn-secondary btn-sm">
              Privacy notice
            </Link>
            <Link href="/profile" className="btn btn-quiet btn-sm">
              Security settings
            </Link>
          </div>
        </article>
      </div>

      <div className="flex items-start gap-2.5 rounded-2xl border border-line bg-surface-2/60 p-4">
        <HelpCircle size={17} className="mt-0.5 shrink-0 text-ink-3" aria-hidden="true" />
        <p className="text-label leading-relaxed text-ink-2">
          {isLearner
            ? "Still stuck? Ask your teacher or contact the school office. Never share your password with anyone."
            : "Still stuck? Contact the Director or Head Teacher at the school office. For fee questions, include the learner’s admission number so the accountant can find the right invoice quickly."}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-caption text-ink-3">
        <CircleDollarSign size={13} aria-hidden="true" />
        <span>Fees are in Kenyan Shillings (KES). Times and dates use East Africa Time.</span>
      </div>
    </section>
  );
}
