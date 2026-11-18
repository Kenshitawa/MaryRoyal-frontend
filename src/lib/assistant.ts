import type { Role } from "@prisma/client";
import { db } from "@/lib/db";
import { canInScope } from "@/lib/permissions";

export type AssistantReply = {
  reply: string;
  bullets: string[];
  links: { label: string; href: string }[];
  suggestions: string[];
  provider: "local";
};

const kes = (value: number) =>
  new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(value);

const pct = (part: number, total: number) => (total ? Math.round((part / total) * 100) : 0);

const has = (question: string, ...words: string[]) => words.some((word) => question.includes(word));

const gradeNumber = (grade: string) => {
  const match = /^Grade\s+(\d+)$/i.exec(grade);
  return match ? Number(match[1]) : Number.POSITIVE_INFINITY;
};

const todayUtc = () =>
  new Date(
    `${new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Nairobi", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date())}T00:00:00.000Z`,
  );

type PersonalChild = {
  id: string;
  name: string;
  grade: string;
  attendance: { present: number; absent: number; late: number; marked: number; rate: number | null; lastStatus: string | null; lastDate: Date | null };
  released: { count: number; rows: { subject: string; score: number; term: string }[] };
  fees: { invoiced: number; paid: number; balance: number; invoices: number } | null;
  work: { total: number; submitted: number; marked: number; outstanding: number } | null;
  games: { played: number; best: number | null };
};

type PersonalSnapshot = {
  kind: "learner" | "parent";
  children: PersonalChild[];
  ownOpenComplaints: number | null;
};

type Snapshot = {
  personal?: PersonalSnapshot;
  learners?: { total: number; grades: number; pendingAdmissions: number };
  attendance?: { present: number; absent: number; late: number; marked: number; rate7: number };
  finance?: { invoiced: number; collected: number; outstanding: number; invoices: number; unpaid: number; topClasses: { grade: string; balance: number }[] };
  assessments?: { submitted: number; drafts: number; released: number };
  staff?: { total: number };
  payroll?: { pending: number; period: string };
  welfare?: { pendingLoans: number; ownSavings: number; ownActiveLoans: number };
  complaints?: { open: number };
  timetable?: { published: boolean };
  teacher?: { classes: string[]; learners: number; attendanceToday: number; drafts: number };
};

async function buildSnapshot(role: Role, userId: string): Promise<Snapshot> {
  if (role === "PARENT" || role === "LEARNER") {
    return { personal: await buildPersonalSnapshot(role, userId) };
  }
  const snapshot: Snapshot = {};
  const today = todayUtc();
  const weekStart = new Date(today);
  weekStart.setUTCDate(weekStart.getUTCDate() - 7);
  const period = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", timeZone: "Africa/Nairobi" }).format(new Date());

  const canViewLearners = canInScope(role, "learners", "view", "school") || canInScope(role, "learners", "view", "learner-identity");
  const canViewFinance = canInScope(role, "finance", "view", "school");
  const canViewAttendance = canInScope(role, "attendance", "view", "school");
  const canViewAssessments = canInScope(role, "assessments", "view", "school");
  const canViewStaff = canInScope(role, "staff", "view", "school");
  const canViewPayroll = canInScope(role, "payroll", "view", "school");
  const canViewWelfare = canInScope(role, "welfare", "view", "school");
  const canViewComplaints = canInScope(role, "complaints", "view", "school");
  const canViewAdmissions = canInScope(role, "admissions", "view", "school");
  const canViewTimetable = canInScope(role, "timetable", "view", "school") || canInScope(role, "timetable", "view", "assigned");
  const canViewOwnWelfare = canInScope(role, "welfare", "view", "self");

  const [
    learnerTotal,
    gradeRows,
    pendingAdmissions,
    presentToday,
    absentToday,
    lateToday,
    weekRecords,
    weekPresent,
    financeRows,
    assessmentRows,
    staffTotal,
    payrollPending,
    pendingLoans,
    complaintOpen,
    timetable,
    ownWelfare,
    teacherAssignments,
  ] = await Promise.all([
    canViewLearners ? db.learner.count({ where: { archivedAt: null } }) : null,
    canViewLearners
      ? db.learner.groupBy({ by: ["grade"], where: { archivedAt: null }, _count: { id: true }, orderBy: { grade: "asc" } })
      : null,
    canViewAdmissions ? db.learner.count({ where: { archivedAt: null, admissionStatus: "PENDING" } }) : null,
    canViewAttendance ? db.attendance.count({ where: { date: today, status: "PRESENT" } }) : null,
    canViewAttendance ? db.attendance.count({ where: { date: today, status: "ABSENT" } }) : null,
    canViewAttendance ? db.attendance.count({ where: { date: today, status: "LATE" } }) : null,
    canViewAttendance ? db.attendance.count({ where: { date: { gte: weekStart, lte: today } } }) : null,
    canViewAttendance ? db.attendance.count({ where: { date: { gte: weekStart, lte: today }, status: "PRESENT" } }) : null,
    canViewFinance
      ? db.feeInvoice.findMany({
          where: {},
          select: {
            creditApplied: true,
            learner: { select: { grade: true } },
            lines: { select: { amount: true } },
            payments: { where: { status: "RECORDED" }, select: { amount: true } },
          },
          take: 2000,
        })
      : null,
    canViewAssessments
      ? db.assessment.groupBy({ by: ["status"], where: {}, _count: { id: true } })
      : null,
    canViewStaff
      ? db.user.count({ where: { suspended: false, role: { notIn: ["PARENT", "LEARNER"] } } })
      : null,
    canViewPayroll
      ? db.payrollEntry.aggregate({ where: { period, status: "PENDING" }, _sum: { netAmount: true } })
      : null,
    canViewWelfare ? db.welfareLoan.count({ where: { status: { startsWith: "PENDING" } } }) : null,
    canViewComplaints ? db.complaint.count({ where: { status: { in: ["OPEN", "IN_REVIEW"] } } }) : null,
    canViewTimetable
      ? db.schoolTimetable.findFirst({ where: { status: "PUBLISHED" }, select: { id: true } })
      : null,
    canViewOwnWelfare
      ? db.welfareMember.findFirst({ where: { userId }, select: { totalSavings: true, loans: { select: { status: true } } } })
      : null,
    role === "TEACHER"
      ? db.teacherAssignment.findMany({ where: { teacherId: userId }, select: { grade: true, subject: true } })
      : null,
  ]);

  if (learnerTotal !== null) {
    snapshot.learners = {
      total: learnerTotal,
      grades: gradeRows?.length ?? 0,
      pendingAdmissions: pendingAdmissions ?? 0,
    };
  } else if (pendingAdmissions !== null) {
    snapshot.learners = { total: 0, grades: 0, pendingAdmissions };
  }

  if (presentToday !== null && absentToday !== null && lateToday !== null && weekRecords !== null && weekPresent !== null) {
    snapshot.attendance = {
      present: presentToday,
      absent: absentToday,
      late: lateToday,
      marked: presentToday + absentToday + lateToday,
      rate7: pct(weekPresent, weekRecords),
    };
  }

  if (financeRows) {
    let invoiced = 0;
    let collected = 0;
    let unpaid = 0;
    const byGrade = new Map<string, number>();
    for (const invoice of financeRows) {
      const total = invoice.lines.reduce((sum, line) => sum + line.amount, 0);
      const paid = invoice.payments.reduce((sum, payment) => sum + payment.amount, 0);
      const balance = Math.max(0, total - paid - invoice.creditApplied);
      invoiced += total;
      collected += paid;
      if (balance > 0) unpaid += 1;
      byGrade.set(invoice.learner.grade, (byGrade.get(invoice.learner.grade) ?? 0) + balance);
    }
    snapshot.finance = {
      invoiced,
      collected,
      outstanding: Math.max(0, invoiced - collected),
      invoices: financeRows.length,
      unpaid,
      topClasses: [...byGrade.entries()]
        .map(([grade, balance]) => ({ grade, balance }))
        .filter((row) => row.balance > 0)
        .sort((a, b) => b.balance - a.balance || gradeNumber(a.grade) - gradeNumber(b.grade))
        .slice(0, 3),
    };
  }

  if (assessmentRows) {
    const count = (status: string) => assessmentRows.find((row) => row.status === status)?._count.id ?? 0;
    snapshot.assessments = { submitted: count("SUBMITTED"), drafts: count("DRAFT"), released: count("RELEASED") };
  }

  if (staffTotal !== null) snapshot.staff = { total: staffTotal };
  if (payrollPending) snapshot.payroll = { pending: payrollPending._sum.netAmount ?? 0, period };
  if (pendingLoans !== null || ownWelfare) {
    const loans = ownWelfare?.loans ?? [];
    snapshot.welfare = {
      pendingLoans: pendingLoans ?? loans.filter((loan) => loan.status.startsWith("PENDING")).length,
      ownSavings: ownWelfare?.totalSavings ?? 0,
      ownActiveLoans: loans.filter((loan) => ["APPROVED", "DISBURSED"].includes(loan.status)).length,
    };
  }
  if (complaintOpen !== null) snapshot.complaints = { open: complaintOpen };
  if (canViewTimetable) snapshot.timetable = { published: Boolean(timetable) };

  if (teacherAssignments) {
    const classes = [...new Set(teacherAssignments.map((item) => item.grade))];
    const [learners, attendanceToday, drafts] = await Promise.all([
      db.learner.count({ where: { grade: { in: classes }, archivedAt: null } }),
      db.attendance.count({ where: { date: today, status: "PRESENT", learner: { grade: { in: classes } } } }),
      db.assessment.count({ where: { enteredById: userId, status: { in: ["DRAFT", "RETURNED"] } } }),
    ]);
    snapshot.teacher = {
      classes: classes.sort((a, b) => gradeNumber(a) - gradeNumber(b)),
      learners,
      attendanceToday,
      drafts,
    };
  }

  return snapshot;
}

/**
 * Family snapshot for learners and parents. Only the learner records linked to
 * the signed-in account are read: a learner sees themselves, a parent sees
 * their own children. Nothing school-wide is included.
 */
async function buildPersonalSnapshot(role: Role, userId: string): Promise<PersonalSnapshot> {
  const links = await db.guardianLink.findMany({
    where: {
      userId,
      relation: "Learner",
      learner: { archivedAt: null, admissionStatus: "APPROVED" },
    },
    select: { learner: { select: { id: true, name: true, grade: true } } },
    orderBy: { learner: { name: "asc" } },
    take: 12,
  });
  const learners = links.map((link) => link.learner);
  const ids = learners.map((learner) => learner.id);
  const grades = [...new Set(learners.map((learner) => learner.grade))];
  const hasLearners = ids.length > 0;

  const [attendanceRows, assessmentRows, invoiceRows, assignmentRows, submissionRows, gameRows, ownOpenComplaints] =
    await Promise.all([
      hasLearners
        ? db.attendance.findMany({
            where: { learnerId: { in: ids } },
            select: { learnerId: true, status: true, date: true },
            orderBy: { date: "desc" },
            take: 400,
          })
        : Promise.resolve([]),
      hasLearners
        ? db.assessment.findMany({
            where: { learnerId: { in: ids }, status: "RELEASED" },
            select: { learnerId: true, subject: true, score: true, term: true },
            orderBy: [{ term: "desc" }, { subject: "asc" }],
            take: 400,
          })
        : Promise.resolve([]),
      role === "PARENT" && hasLearners
        ? db.feeInvoice.findMany({
            where: { learnerId: { in: ids } },
            select: {
              learnerId: true,
              creditApplied: true,
              lines: { select: { amount: true } },
              payments: { where: { status: "RECORDED" }, select: { amount: true } },
            },
            take: 500,
          })
        : Promise.resolve([]),
      role === "LEARNER" && grades.length
        ? db.assignment.findMany({
            where: { grade: { in: grades } },
            select: { id: true },
            take: 300,
          })
        : Promise.resolve([]),
      role === "LEARNER" && hasLearners
        ? db.assignmentSubmission.findMany({
            where: { learnerId: { in: ids } },
            select: { learnerId: true, assignmentId: true, status: true },
            take: 400,
          })
        : Promise.resolve([]),
      role === "LEARNER" && hasLearners
        ? db.learningGameAttempt.findMany({
            where: { learnerId: { in: ids } },
            select: { learnerId: true, score: true, maxScore: true },
            take: 300,
          })
        : Promise.resolve([]),
      role === "PARENT"
        ? db.complaint.count({ where: { openedById: userId, status: { in: ["OPEN", "IN_REVIEW"] } } })
        : Promise.resolve(null),
    ]);

  const children = learners.map((learner): PersonalChild => {
    const attendance = attendanceRows.filter((row) => row.learnerId === learner.id);
    const present = attendance.filter((row) => row.status === "PRESENT").length;
    const absent = attendance.filter((row) => row.status === "ABSENT").length;
    const late = attendance.filter((row) => row.status === "LATE").length;
    const released = assessmentRows.filter((row) => row.learnerId === learner.id);
    const invoices = invoiceRows.filter((row) => row.learnerId === learner.id);
    const submissions = submissionRows.filter((row) => row.learnerId === learner.id);
    const games = gameRows.filter((row) => row.learnerId === learner.id);

    let fees: PersonalChild["fees"] = null;
    if (role === "PARENT") {
      let invoiced = 0;
      let paid = 0;
      for (const invoice of invoices) {
        invoiced += invoice.lines.reduce((sum, line) => sum + line.amount, 0);
        paid += invoice.payments.reduce((sum, payment) => sum + payment.amount, 0) + invoice.creditApplied;
      }
      fees = { invoiced, paid, balance: Math.max(0, invoiced - paid), invoices: invoices.length };
    }

    let work: PersonalChild["work"] = null;
    if (role === "LEARNER") {
      const total = assignmentRows.length;
      const submitted = new Set(submissions.map((row) => row.assignmentId)).size;
      work = {
        total,
        submitted,
        marked: submissions.filter((row) => row.status === "MARKED").length,
        outstanding: Math.max(0, total - submitted),
      };
    }

    return {
      id: learner.id,
      name: learner.name,
      grade: learner.grade,
      attendance: {
        present,
        absent,
        late,
        marked: attendance.length,
        rate: attendance.length ? pct(present, attendance.length) : null,
        lastStatus: attendance[0]?.status ?? null,
        lastDate: attendance[0]?.date ?? null,
      },
      released: { count: released.length, rows: released.slice(0, 6) },
      fees,
      work,
      games: {
        played: games.length,
        best: games.length
          ? Math.max(...games.map((game) => (game.maxScore ? pct(game.score, game.maxScore) : 0)))
          : null,
      },
    };
  });

  return { kind: role === "LEARNER" ? "learner" : "parent", children, ownOpenComplaints };
}

function personalOverview(personal: PersonalSnapshot, name: string): AssistantReply {
  const first = name.trim().split(/\s+/)[0] || "there";
  if (!personal.children.length) {
    return {
      reply:
        personal.kind === "learner"
          ? `Hi ${first}. Your learner profile is not linked to this account yet, so I cannot read your own records.`
          : `Hello ${first}. No approved learner is linked to this account yet, so I cannot read any child records.`,
      bullets: ["Ask the school office to connect the account to the approved admission."],
      links: [{ label: "Open my learning", href: "/learning" }],
      suggestions: ["Help me find a page"],
      provider: "local",
    };
  }

  const bullets = personal.children.map((child) => {
    const parts: string[] = [];
    parts.push(child.attendance.rate === null ? "no attendance yet" : `${child.attendance.rate}% attendance`);
    parts.push(`${child.released.count} released result${child.released.count === 1 ? "" : "s"}`);
    if (child.fees) parts.push(`${kes(child.fees.balance)} fee balance`);
    if (child.work) parts.push(`${child.work.outstanding} task${child.work.outstanding === 1 ? "" : "s"} to hand in`);
    return `${personal.kind === "learner" ? "" : `${child.name} (${child.grade}): `}${parts.join(", ")}.`;
  });

  return {
    reply:
      personal.kind === "learner"
        ? `Here is your own record, ${first}.`
        : `Here is where your children stand today, ${first}.`,
    bullets,
    links:
      personal.kind === "learner"
        ? [
            { label: "Open my learning", href: "/learning" },
            { label: "Open assignments", href: "/assignments" },
            { label: "Open attendance", href: "/attendance" },
          ]
        : [
            { label: "Open family portal", href: "/portal" },
            { label: "Open attendance", href: "/attendance" },
          ],
    suggestions:
      personal.kind === "learner"
        ? ["My attendance", "My marks", "What homework is left?"]
        : ["Fee balance", "Attendance", "Any messages?"],
    provider: "local",
  };
}

function answerPersonal(personal: PersonalSnapshot, text: string, name: string): AssistantReply {
  const child = personal.children[0];
  const isLearner = personal.kind === "learner";
  const pageLinks = isLearner
    ? [
        { label: "Open my learning", href: "/learning" },
        { label: "Open assignments", href: "/assignments" },
        { label: "Open attendance", href: "/attendance" },
      ]
    : [
        { label: "Open family portal", href: "/portal" },
        { label: "Open attendance", href: "/attendance" },
      ];

  if (has(text, "fee", "fees", "money", "balance", "balances", "owe", "owes", "owed", "payment", "payments", "invoice", "invoices", "receipt", "arrears")) {
    if (isLearner) {
      return {
        reply: "Fee statements belong to your parent or guardian account, so I cannot show them here.",
        bullets: ["A grown-up can open the family portal with their own sign-in to see fees and receipts."],
        links: [{ label: "Open my learning", href: "/learning" }],
        suggestions: ["My marks", "My attendance", "What homework is left?"],
        provider: "local",
      };
    }
    if (!personal.children.length) return personalOverview(personal, name);
    const perChild = personal.children.map((item) => {
      const fees = item.fees;
      if (!fees || !fees.invoices) return `${item.name}: no invoice has been issued yet.`;
      return fees.balance > 0
        ? `${item.name}: ${kes(fees.balance)} still to pay of ${kes(fees.invoiced)}.`
        : `${item.name}: fully paid.`;
    });
    const total = personal.children.reduce((sum, item) => sum + (item.fees?.balance ?? 0), 0);
    return {
      reply: total > 0 ? `${kes(total)} is outstanding in total.` : "Every issued invoice is fully paid.",
      bullets: perChild,
      links: [{ label: "Open fees & receipts", href: "/portal?tab=fees" }],
      suggestions: ["Attendance", "Latest results", "Any messages?"],
      provider: "local",
    };
  }

  if (has(text, "attendance", "absent", "present", "late", "register", "school today")) {
    if (!personal.children.length) return personalOverview(personal, name);
    const bullets = personal.children.map((item) => {
      const a = item.attendance;
      if (!a.marked) return `${item.name}: no attendance recorded yet.`;
      const last = a.lastStatus ? ` Last marked ${a.lastStatus.toLowerCase()}.` : "";
      return `${item.name}: ${a.present} present, ${a.absent} absent, ${a.late} late in ${a.marked} recorded days (${a.rate}%).${last}`;
    });
    return {
      reply: isLearner ? "Here is your own attendance record." : "Here is each child's attendance record.",
      bullets,
      links: [{ label: "Open attendance", href: "/attendance" }],
      suggestions: isLearner ? ["My marks", "What homework is left?"] : ["Fee balance", "Latest results"],
      provider: "local",
    };
  }

  if (has(text, "mark", "marks", "result", "results", "assessment", "assessments", "exam", "exams", "score", "scores", "report")) {
    if (!personal.children.length) return personalOverview(personal, name);
    const bullets = personal.children.map((item) => {
      if (!item.released.count) return `${item.name}: no released results yet.`;
      const recent = item.released.rows
        .slice(0, 3)
        .map((row) => `${row.subject} ${Math.round(row.score)}%`)
        .join(", ");
      return `${item.name}: ${item.released.count} released result${item.released.count === 1 ? "" : "s"} — ${recent}.`;
    });
    return {
      reply: "Only marks released by the school appear here.",
      bullets,
      links: isLearner
        ? [{ label: "Open my results", href: "/learning#released-assessments" }]
        : [{ label: "Open results", href: "/portal?tab=results" }],
      suggestions: ["My attendance", "Any messages?"],
      provider: "local",
    };
  }

  if (has(text, "homework", "assignment", "assignments", "task", "tasks", "classwork", "hand in", "submit")) {
    if (!isLearner) {
      return {
        reply: "Classwork tasks are shown on each learner's own sign-in, not on the family portal.",
        bullets: ["Open the family portal for results, attendance and fee statements."],
        links: [{ label: "Open family portal", href: "/portal" }],
        suggestions: ["Latest results", "Fee balance"],
        provider: "local",
      };
    }
    if (!child?.work) return personalOverview(personal, name);
    const work = child.work;
    return {
      reply: work.outstanding
        ? `${work.outstanding} task${work.outstanding === 1 ? "" : "s"} still need${work.outstanding === 1 ? "s" : ""} handing in.`
        : "Every classwork task is handed in. Well done!",
      bullets: [
        `Tasks for your class: ${work.total}`,
        `Handed in: ${work.submitted}`,
        `Marked by your teacher: ${work.marked}`,
      ],
      links: [{ label: "Open assignments", href: "/assignments" }],
      suggestions: ["My marks", "Practice games", "My attendance"],
      provider: "local",
    };
  }

  if (has(text, "game", "games", "practice", "quiz", "score")) {
    if (!isLearner || !child) return personalOverview(personal, name);
    return {
      reply: child.games.played
        ? `You have finished ${child.games.played} practice round${child.games.played === 1 ? "" : "s"}. Best score: ${child.games.best}%.`
        : "You have not played a practice game yet.",
      bullets: ["Practice rounds are short quizzes that help you revise."],
      links: [{ label: "Open practice games", href: "/learning#practice" }],
      suggestions: ["My marks", "What homework is left?"],
      provider: "local",
    };
  }

  if (has(text, "complaint", "complaints", "message", "messages", "inquiry", "teacher")) {
    if (isLearner) {
      return {
        reply: "Messages to the school are sent by your parent or guardian from their own account.",
        bullets: ["Ask a grown-up to sign in and open Messages if you need to tell the school something."],
        links: pageLinks.slice(0, 1),
        suggestions: ["My marks", "My attendance"],
        provider: "local",
      };
    }
    return {
      reply: personal.ownOpenComplaints
        ? `${personal.ownOpenComplaints} of your message${personal.ownOpenComplaints === 1 ? "" : "s"} to the school ${personal.ownOpenComplaints === 1 ? "is" : "are"} still open.`
        : "You have no open messages to the school.",
      bullets: ["Only the Head Teacher and Director read parent messages."],
      links: [{ label: "Open messages", href: "/complaints" }],
      suggestions: ["Fee balance", "Attendance", "Latest results"],
      provider: "local",
    };
  }

  if (has(text, "video", "videos", "lesson", "lessons", "library", "book", "books", "learn", "learning", "watch")) {
    return {
      reply: isLearner ? "Your lessons and KICD videos are ready to watch." : "Lessons and KICD videos are on your child's own sign-in.",
      bullets: [isLearner ? "Open My Learning to pick a lesson or video." : "Ask your child to sign in with their learner account to watch lessons."],
      links: [{ label: isLearner ? "Open My Learning" : "Open family portal", href: isLearner ? "/learning-videos" : "/portal" }],
      suggestions: isLearner ? ["My marks", "What homework is left?"] : ["Latest results", "Fee balance"],
      provider: "local",
    };
  }

  if (has(text, "help", "where", "how do i", "how to", "find", "open", "page", "navigate", "menu")) {
    return {
      reply: isLearner
        ? "Here is where to find your schoolwork."
        : "Here is where to find your children's information.",
      bullets: isLearner
        ? ["My learning: lessons, results and practice games.", "Assignments: classwork to hand in.", "Attendance: your roll-call record."]
        : ["Family portal: results, attendance and fees for each child.", "Messages: talk to the Head Teacher or Director."],
      links: pageLinks,
      suggestions: isLearner ? ["My marks", "What homework is left?"] : ["Fee balance", "Attendance"],
      provider: "local",
    };
  }

  return personalOverview(personal, name);
}

function overview(snapshot: Snapshot): AssistantReply {
  const bullets: string[] = [];
  const links: { label: string; href: string }[] = [];
  const pending: string[] = [];

  if (snapshot.finance) {
    bullets.push(`Fees: ${kes(snapshot.finance.outstanding)} outstanding across ${snapshot.finance.unpaid} unpaid invoice${snapshot.finance.unpaid === 1 ? "" : "s"}.`);
    if (snapshot.finance.unpaid) pending.push("fee balances");
    links.push({ label: "Open finance", href: "/finance" });
  }
  if (snapshot.attendance) {
    bullets.push(`Attendance today: ${snapshot.attendance.present} present, ${snapshot.attendance.absent} absent, ${snapshot.attendance.late} late.`);
    links.push({ label: "Open attendance", href: "/attendance" });
  }
  if (snapshot.learners) {
    bullets.push(`Learners: ${snapshot.learners.total} active across ${snapshot.learners.grades} classes.`);
    if (snapshot.learners.pendingAdmissions) pending.push(`${snapshot.learners.pendingAdmissions} admission${snapshot.learners.pendingAdmissions === 1 ? "" : "s"}`);
    links.push({ label: "Open learners", href: "/learners" });
  }
  if (snapshot.assessments?.submitted) {
    bullets.push(`Assessments: ${snapshot.assessments.submitted} submission${snapshot.assessments.submitted === 1 ? "" : "s"} waiting for review.`);
    pending.push("marks to review");
    links.push({ label: "Open assessments", href: "/assessments" });
  }
  if (snapshot.welfare?.pendingLoans) {
    bullets.push(`Welfare: ${snapshot.welfare.pendingLoans} loan request${snapshot.welfare.pendingLoans === 1 ? "" : "s"} awaiting approval.`);
    pending.push("welfare approvals");
    links.push({ label: "Open welfare", href: "/welfare" });
  }
  if (snapshot.complaints?.open) {
    bullets.push(`Complaints: ${snapshot.complaints.open} open parent message${snapshot.complaints.open === 1 ? "" : "s"}.`);
    pending.push("parent complaints");
    links.push({ label: "Open complaints", href: "/complaints" });
  }
  if (snapshot.payroll?.pending) {
    bullets.push(`Payroll: ${kes(snapshot.payroll.pending)} net pay still pending for ${snapshot.payroll.period}.`);
    pending.push("payroll");
    links.push({ label: "Open payroll", href: "/finance" });
  }
  if (snapshot.teacher) {
    bullets.push(
      snapshot.teacher.classes.length
        ? `Your classes: ${snapshot.teacher.classes.join(", ")} · ${snapshot.teacher.learners} learners.`
        : "You have no classes assigned yet.",
    );
    if (snapshot.teacher.drafts) pending.push(`${snapshot.teacher.drafts} draft mark${snapshot.teacher.drafts === 1 ? "" : "s"}`);
    links.push({ label: "Open timetable", href: "/timetable" });
  }

  return {
    reply: pending.length
      ? `Here is what needs attention right now, ${pending.slice(0, 3).join(", ")}.`
      : "Everything I can see is up to date right now.",
    bullets: bullets.length ? bullets : ["I could not find any school totals for your role yet."],
    links: links.slice(0, 4),
    suggestions: ["What fees are pending?", "Attendance today", "Anything waiting for approval?"],
    provider: "local",
  };
}

/**
 * Read-only, permission-scoped assistant. Answers are computed from the same
 * database rows the user can already open; no message or school data leaves
 * the server, and no external model is called.
 */
export async function answerQuestion({
  question,
  role,
  userId,
  name,
}: {
  question: string;
  role: Role;
  userId: string;
  name: string;
}): Promise<AssistantReply> {
  const snapshot = await buildSnapshot(role, userId);
  const text = question.toLowerCase().replace(/[?!.,]/g, " ").replace(/\s+/g, " ").trim();

  if (snapshot.personal) {
    return answerPersonal(snapshot.personal, text, name);
  }

  if (/^(hi|hello|hey|good (morning|afternoon|evening))\b/.test(text) || text === "") {
    return {
      reply: `Hello ${name.split(" ")[0]}. Ask me about fees, attendance, learners, marks, staff, welfare or where to find a page.`,
      bullets: [
        "I read live school totals using your permissions.",
        "I can point you to the page where you can take action.",
        "I never send school data outside this server.",
      ],
      links: [],
      suggestions: ["What fees are pending?", "Who is absent today?", "Open the timetable"],
      provider: "local",
    };
  }

  if (has(text, "fee", "fees", "money", "balance", "balances", "owe", "owes", "owed", "payment", "payments", "collection", "invoice", "invoices", "arrears")) {
    if (!snapshot.finance) {
      return {
        reply: "Your role does not include school-wide finance figures, so I cannot show fee totals.",
        bullets: ["You can still open your own fee or payroll pages from the menu."],
        links: [],
        suggestions: ["Attendance today", "Anything waiting for approval?", "Help me find a page"],
        provider: "local",
      };
    }
    const { invoiced, collected, outstanding, unpaid, invoices, topClasses } = snapshot.finance;
    return {
      reply: `${kes(outstanding)} is still outstanding on ${unpaid} of ${invoices} invoices. ${pct(collected, invoiced)}% of ${kes(invoiced)} has been collected.`,
      bullets: [
        `Collected: ${kes(collected)}`,
        `Outstanding: ${kes(outstanding)}`,
        unpaid ? `Unpaid invoices: ${unpaid}` : "Every invoice is fully settled.",
        ...topClasses.map((row) => `${row.grade}: ${kes(row.balance)} outstanding`),
      ],
      links: [{ label: "Open finance", href: "/finance" }],
      suggestions: ["Which class owes the most?", "Attendance today", "Marks waiting for review"],
      provider: "local",
    };
  }

  if (has(text, "attendance", "absent", "present", "late", "register")) {
    if (!snapshot.attendance) {
      return {
        reply: "Attendance is outside your role's access, so I cannot show the register.",
        bullets: [],
        links: [],
        suggestions: ["What fees are pending?", "Help me find a page"],
        provider: "local",
      };
    }
    const { present, absent, late, marked, rate7 } = snapshot.attendance;
    return {
      reply: marked
        ? `${present} learners are present today, ${absent} absent and ${late} late. Seven-day presence rate: ${rate7}%.`
        : "No attendance has been marked today yet.",
      bullets: marked
        ? [`Marked records today: ${marked}`, `Present rate today: ${pct(present, marked)}%`, `Last 7 days: ${rate7}% present`]
        : ["Open Attendance to start today's register."],
      links: [{ label: "Open attendance", href: "/attendance" }],
      suggestions: ["Who is absent today?", "What fees are pending?", "Anything waiting for approval?"],
      provider: "local",
    };
  }

  if (has(text, "learner", "learners", "student", "students", "enrol", "register", "class", "classes")) {
    if (!snapshot.learners && !snapshot.teacher) {
      return overview(snapshot);
    }
    if (snapshot.teacher) {
      const classes = snapshot.teacher.classes;
      return {
        reply: classes.length
          ? `You teach ${classes.length} class${classes.length === 1 ? "" : "es"}: ${classes.join(", ")} with ${snapshot.teacher.learners} learners.`
          : "You do not have any classes assigned yet.",
        bullets: [
          `${snapshot.teacher.attendanceToday} of your learners are marked present today.`,
          `${snapshot.teacher.drafts} mark${snapshot.teacher.drafts === 1 ? "" : "s"} still in draft.`,
        ],
        links: [{ label: "Open learners", href: "/learners" }],
        suggestions: ["Attendance today", "Help me find a page"],
        provider: "local",
      };
    }
    const learners = snapshot.learners!;
    return {
      reply: `${learners.total} active learners are on the register across ${learners.grades} classes.`,
      bullets: learners.pendingAdmissions
        ? [`${learners.pendingAdmissions} admission${learners.pendingAdmissions === 1 ? "" : "s"} still waiting for approval.`]
        : ["No admissions are waiting for approval."],
      links: [{ label: "Open learners", href: "/learners" }, { label: "Open admissions", href: "/admissions" }],
      suggestions: ["What fees are pending?", "Attendance today", "Marks waiting for review"],
      provider: "local",
    };
  }

  if (has(text, "mark", "marks", "result", "results", "assessment", "assessments", "exam", "exams", "review", "release")) {
    if (!snapshot.assessments && !snapshot.teacher) {
      return {
        reply: "Assessment figures are outside your role's access.",
        bullets: [],
        links: [],
        suggestions: ["What fees are pending?", "Help me find a page"],
        provider: "local",
      };
    }
    if (snapshot.teacher) {
      return {
        reply: snapshot.teacher.drafts
          ? `You have ${snapshot.teacher.drafts} mark${snapshot.teacher.drafts === 1 ? "" : "s"} in draft or returned for correction.`
          : "You have no draft marks waiting.",
        bullets: ["Open Assessments to enter or submit marks."],
        links: [{ label: "Open assessments", href: "/assessments" }],
        suggestions: ["Attendance today", "Help me find a page"],
        provider: "local",
      };
    }
    const assessments = snapshot.assessments!;
    return {
      reply: assessments.submitted
        ? `${assessments.submitted} assessment submission${assessments.submitted === 1 ? "" : "s"} are waiting for review.`
        : "No assessment submissions are waiting for review.",
      bullets: [`Drafts in progress: ${assessments.drafts}`, `Results released: ${assessments.released}`],
      links: [{ label: "Open assessments", href: "/assessments" }],
      suggestions: ["What fees are pending?", "Attendance today", "Anything waiting for approval?"],
      provider: "local",
    };
  }

  if (has(text, "admission", "admissions", "new learner", "join")) {
    if (!snapshot.learners) {
      return overview(snapshot);
    }
    return {
      reply: snapshot.learners.pendingAdmissions
        ? `${snapshot.learners.pendingAdmissions} admission${snapshot.learners.pendingAdmissions === 1 ? "" : "s"} are waiting for approval.`
        : "No admissions are waiting for approval.",
      bullets: [`Active learners: ${snapshot.learners.total}`],
      links: [{ label: "Open admissions", href: "/admissions" }],
      suggestions: ["What fees are pending?", "Attendance today"],
      provider: "local",
    };
  }

  if (has(text, "staff", "teacher", "teachers", "team", "payroll", "salary", "salaries")) {
    if (!snapshot.staff && !snapshot.payroll) {
      return overview(snapshot);
    }
    const bullets: string[] = [];
    if (snapshot.staff) bullets.push(`Active staff accounts: ${snapshot.staff.total}`);
    if (snapshot.payroll) bullets.push(`Net pay pending for ${snapshot.payroll.period}: ${kes(snapshot.payroll.pending)}`);
    return {
      reply: "Here is the current staffing and payroll position.",
      bullets,
      links: [{ label: "Open staff", href: "/staff" }, { label: "Open payroll", href: "/finance" }],
      suggestions: ["What fees are pending?", "Anything waiting for approval?"],
      provider: "local",
    };
  }

  if (has(text, "welfare", "loan", "loans", "savings", "contribution", "contributions")) {
    if (!snapshot.welfare) {
      return overview(snapshot);
    }
    const bullets = [`Loan requests pending approval: ${snapshot.welfare.pendingLoans}`];
    if (snapshot.welfare.ownSavings) bullets.push(`Your savings: ${kes(snapshot.welfare.ownSavings)}`);
    if (snapshot.welfare.ownActiveLoans) bullets.push(`Your active loans: ${snapshot.welfare.ownActiveLoans}`);
    return {
      reply: snapshot.welfare.pendingLoans
        ? `${snapshot.welfare.pendingLoans} welfare loan request${snapshot.welfare.pendingLoans === 1 ? "" : "s"} need attention.`
        : "No welfare loan requests are waiting.",
      bullets,
      links: [{ label: "Open welfare", href: "/welfare" }],
      suggestions: ["What fees are pending?", "Help me find a page"],
      provider: "local",
    };
  }

  if (has(text, "complaint", "complaints", "parent message", "messages")) {
    if (!snapshot.complaints) {
      return overview(snapshot);
    }
    return {
      reply: snapshot.complaints.open
        ? `${snapshot.complaints.open} parent complaint${snapshot.complaints.open === 1 ? "" : "s"} are open.`
        : "No parent complaints are open.",
      bullets: [],
      links: [{ label: "Open complaints", href: "/complaints" }],
      suggestions: ["Attendance today", "What fees are pending?"],
      provider: "local",
    };
  }

  if (has(text, "timetable", "lesson", "lessons", "schedule", "period")) {
    if (!snapshot.timetable) {
      return {
        reply: "Your role does not include the school timetable.",
        bullets: [],
        links: [],
        suggestions: ["Help me find a page", "Attendance today"],
        provider: "local",
      };
    }
    return {
      reply: snapshot.timetable.published
        ? "A published timetable is available, including today's lessons."
        : "No timetable has been published yet.",
      bullets: [snapshot.timetable.published ? "Open it to see today's periods and rooms." : "A Deputy or Head Teacher can publish one."],
      links: [{ label: "Open timetable", href: "/timetable" }],
      suggestions: ["Anything waiting for approval?", "What fees are pending?"],
      provider: "local",
    };
  }

  if (has(text, "pending", "approval", "approvals", "waiting", "attention", "todo", "to do", "task")) {
    return overview(snapshot);
  }

  if (has(text, "help", "where", "how do i", "how to", "find", "open", "page", "navigate", "menu")) {
    return {
      reply: "Tell me what you want to do and I will point you to the right page. You can also use the Search button in the header for any page or person.",
      bullets: ["Admissions: review and approve new learners.", "Finance: invoices, payments and balances.", "Learners: register, profiles and balances.", "Assessments: marks, exams and rubrics."],
      links: [{ label: "Open the dashboard", href: "/dashboard" }],
      suggestions: ["What fees are pending?", "Attendance today", "Marks waiting for review"],
      provider: "local",
    };
  }

  return overview(snapshot);
}
