import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { db } from "@/lib/db";
import { readSession } from "@/lib/session";
import { canInScope } from "@/lib/permissions";
import { createNotification } from "@/lib/notify";

async function actor() {
  const token = (await cookies()).get("mary_session")?.value;
  const session = token ? await readSession(token) : null;
  if (!session) return null;
  const user = await db.user.findUnique({ where: { id: session.id }, select: { id: true, role: true, suspended: true, forcePasswordChange: true, name: true } });
  return user && !user.suspended && !user.forcePasswordChange ? user : null;
}

const VIEWER_ROLES = ["DIRECTOR", "HEAD_TEACHER", "DEPUTY", "SECRETARY", "ACCOUNTANT", "TEACHER", "WELFARE_CHAIR", "NON_TEACHING_STAFF"];

// GET /api/welfare — returns member info, contributions, loans (self or all for admin/welfare chair)
export async function GET(request: Request) {
  const user = await actor();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (!VIEWER_ROLES.includes(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const url = new URL(request.url);
  const scope = url.searchParams.get("scope");
  const memberId = url.searchParams.get("memberId");

  // Admin/welfare chair/director can see all
  const isAdmin = ["DIRECTOR", "HEAD_TEACHER", "WELFARE_CHAIR"].includes(user.role);

  // Members may see a privacy-preserving ranking, never other members' savings or contributions.
  if (scope === "leaderboard") {
    const totals = await db.welfareContribution.groupBy({ by: ["memberId"], _sum: { amount: true }, orderBy: { _sum: { amount: "desc" } }, take: 10 });
    const ids = totals.map((item) => item.memberId);
    const members = await db.welfareMember.findMany({ where: { id: { in: ids } }, select: { id: true, user: { select: { name: true, role: true } } } });
    const byId = new Map(members.map((member) => [member.id, member]));
    return NextResponse.json({ leaderboard: totals.flatMap((item, index) => {
      const member = byId.get(item.memberId);
      return member ? [{ rank: index + 1, name: member.user.name, role: member.user.role }] : [];
    }) });
  }

  if (scope === "staff" && ["DIRECTOR", "WELFARE_CHAIR"].includes(user.role)) {
    const staff = await db.user.findMany({
      where: { suspended: false, role: { notIn: ["PARENT", "LEARNER"] } },
      select: { id: true, name: true, role: true },
      orderBy: { name: "asc" },
    });
    return NextResponse.json({ staff });
  }

  if (scope === "overview" && isAdmin) {
    const members = await db.welfareMember.findMany({
      include: {
        user: { select: { id: true, name: true, role: true, employmentTitle: true } },
        contributions: { orderBy: { createdAt: "desc" }, take: 50 },
        loans: { orderBy: { createdAt: "desc" } },
      },
      orderBy: { joinedAt: "asc" },
    });
    const products = await db.welfareProduct.findMany({ orderBy: { createdAt: "desc" } });
    return NextResponse.json({ members, products });
  }

  // A specific member's data (admin viewing)
  if (memberId && isAdmin) {
    const member = await db.welfareMember.findUnique({
      where: { id: memberId },
      include: {
        user: { select: { id: true, name: true, role: true, employmentTitle: true } },
        contributions: { orderBy: { createdAt: "desc" } },
        loans: { orderBy: { createdAt: "desc" } },
      },
    });
    if (!member) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ member });
  }

  // Self — find own member record
  const member = await db.welfareMember.findUnique({
    where: { userId: user.id },
    include: {
      contributions: { orderBy: { createdAt: "desc" } },
      loans: { orderBy: { createdAt: "desc" } },
    },
  });
  const products = await db.welfareProduct.findMany({ where: { status: "ACTIVE" }, orderBy: { createdAt: "desc" } });
  return NextResponse.json({ member: member ?? null, products });
}

const enrollSchema = z.object({ userId: z.string().min(1) });
const contributionSchema = z.object({
  memberId: z.string().min(1),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2020).max(2100),
  amount: z.number().int().min(1),
  category: z.enum(["MONTHLY_SAVINGS", "PRODUCT"]),
  productTitle: z.string().trim().max(100).optional(),
  receiptRef: z.string().trim().max(60).optional(),
  notes: z.string().trim().max(500).optional(),
});
const loanSchema = z.object({
  memberId: z.string().min(1),
  type: z.enum(["LOAN", "SALARY_ADVANCE"]),
  principalAmount: z.number().int().min(100),
  repaymentTermMonths: z.number().int().min(1).max(60),
  purpose: z.string().trim().max(300).optional(),
});
const productSchema = z.object({
  title: z.string().trim().min(3).max(80),
  description: z.string().trim().min(5).max(500),
  targetAmount: z.number().int().min(0),
  monthlyAmount: z.number().int().min(0).optional(),
});
const loanActionSchema = z.object({
  loanId: z.string().min(1),
  action: z.enum(["approve", "reject", "disburse"]),
  notes: z.string().trim().max(300).optional(),
});

export async function POST(request: Request) {
  const user = await actor();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const actionEnvelope = z.object({ _action: z.enum(["enroll", "contribution", "loan", "product"]) }).passthrough().safeParse(body);
  if (!actionEnvelope.success) return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  const { _action, ...rest } = actionEnvelope.data;

  // Enroll a staff member
  if (_action === "enroll") {
    if (!["DIRECTOR", "WELFARE_CHAIR"].includes(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const parsed = enrollSchema.safeParse(rest);
    if (!parsed.success) return NextResponse.json({ error: "Invalid data" }, { status: 400 });
    const existing = await db.welfareMember.findUnique({ where: { userId: parsed.data.userId } });
    if (existing) return NextResponse.json({ error: "Already enrolled" }, { status: 409 });
    const member = await db.welfareMember.create({ data: { userId: parsed.data.userId } });
    await createNotification({ userId: parsed.data.userId, title: "Welcome to Welfare", message: "You have been enrolled in the Mary Royal Staff Welfare programme.", type: "SUCCESS", link: "/welfare" });
    return NextResponse.json({ member }, { status: 201 });
  }

  // Record a contribution
  if (_action === "contribution") {
    if (!["DIRECTOR", "WELFARE_CHAIR"].includes(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const parsed = contributionSchema.safeParse(rest);
    if (!parsed.success) return NextResponse.json({ error: "Invalid contribution data" }, { status: 400 });
    const member = await db.welfareMember.findUnique({ where: { id: parsed.data.memberId }, include: { user: true } });
    if (!member) return NextResponse.json({ error: "Member not found" }, { status: 404 });
    const contribution = await db.$transaction(async (tx) => {
      const c = await tx.welfareContribution.create({ data: { ...parsed.data, recordedById: user.id } });
      if (parsed.data.category === "MONTHLY_SAVINGS") {
        await tx.welfareMember.update({ where: { id: member.id }, data: { totalSavings: { increment: parsed.data.amount } } });
      }
      return c;
    });
    await createNotification({ userId: member.userId, title: "Contribution Recorded", message: `KES ${parsed.data.amount.toLocaleString()} ${parsed.data.category === "MONTHLY_SAVINGS" ? "monthly savings" : `(${parsed.data.productTitle ?? "product"})`} recorded for ${parsed.data.month}/${parsed.data.year}.`, type: "SUCCESS", link: "/welfare" });
    // Notify director
    const directors = await db.user.findMany({ where: { role: "DIRECTOR" }, select: { id: true } });
    for (const d of directors) {
      await createNotification({ userId: d.id, title: "Welfare: Contribution Recorded", message: `${member.user.name}: KES ${parsed.data.amount.toLocaleString()} (${parsed.data.category}) for ${parsed.data.month}/${parsed.data.year}.`, type: "INFO", link: "/welfare" });
    }
    return NextResponse.json({ contribution }, { status: 201 });
  }

  // Apply for a loan or salary advance
  if (_action === "loan") {
    if (!canInScope(user.role as never, "welfare", "apply", "self")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const parsed = loanSchema.safeParse(rest);
    if (!parsed.success) return NextResponse.json({ error: "Invalid loan data" }, { status: 400 });
    const member = await db.welfareMember.findUnique({ where: { id: parsed.data.memberId } });
    if (!member) return NextResponse.json({ error: "Member not found" }, { status: 404 });
    if (member.userId !== user.id && user.role !== "DIRECTOR") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // Enforce salary advance max KES 3,000 and only after 15th
    if (parsed.data.type === "SALARY_ADVANCE") {
      if (parsed.data.principalAmount > 3000) return NextResponse.json({ error: "Salary advance maximum is KES 3,000." }, { status: 400 });
      const today = new Date();
      if (today.getDate() < 15) return NextResponse.json({ error: "Salary advances are only available from the 15th of the month onwards." }, { status: 400 });
    }

    // Loan limit: max 60% of savings
    if (parsed.data.type === "LOAN") {
      const maxLoan = Math.floor(member.totalSavings * 0.6);
      if (parsed.data.principalAmount > maxLoan) {
        return NextResponse.json({ error: `Loan limit is 60% of your savings (KES ${maxLoan.toLocaleString()}).` }, { status: 400 });
      }
    }

    const monthlyDeduction = parsed.data.repaymentTermMonths > 0 ? Math.ceil(parsed.data.principalAmount / parsed.data.repaymentTermMonths) : parsed.data.principalAmount;
    const loan = await db.welfareLoan.create({ data: { ...parsed.data, monthlyDeduction, status: "PENDING_HEADTEACHER" } });

    // Notify head teacher
    const headTeachers = await db.user.findMany({ where: { role: "HEAD_TEACHER" }, select: { id: true } });
    for (const ht of headTeachers) {
      await createNotification({ userId: ht.id, title: `Welfare ${parsed.data.type === "SALARY_ADVANCE" ? "Salary Advance" : "Loan"} Application`, message: `New ${parsed.data.type.toLowerCase().replace("_", " ")} of KES ${parsed.data.principalAmount.toLocaleString()} awaiting your approval.`, type: "ACTION", link: "/welfare", actionRequired: true });
    }
    return NextResponse.json({ loan }, { status: 201 });
  }

  // Create a new welfare product
  if (_action === "product") {
    if (!["DIRECTOR", "WELFARE_CHAIR"].includes(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const parsed = productSchema.safeParse(rest);
    if (!parsed.success) return NextResponse.json({ error: "Invalid product data" }, { status: 400 });
    const product = await db.welfareProduct.create({ data: { ...parsed.data, createdById: user.id } });
    return NextResponse.json({ product }, { status: 201 });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

// PATCH /api/welfare — approve/reject/disburse loans
export async function PATCH(request: Request) {
  const user = await actor();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const parsed = loanActionSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid data" }, { status: 400 });

  const loan = await db.welfareLoan.findUnique({ where: { id: parsed.data.loanId }, include: { member: { include: { user: true } } } });
  if (!loan) return NextResponse.json({ error: "Loan not found" }, { status: 404 });

  // Head teacher approves/rejects PENDING_HEADTEACHER
  if (parsed.data.action === "approve" && loan.status === "PENDING_HEADTEACHER") {
    if (!["HEAD_TEACHER", "DIRECTOR"].includes(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    await db.welfareLoan.update({ where: { id: loan.id }, data: { status: "PENDING_DIRECTOR", headteacherNotes: parsed.data.notes ?? null, headteacherApprovedAt: new Date() } });
    // Notify director
    const directors = await db.user.findMany({ where: { role: "DIRECTOR" }, select: { id: true } });
    for (const d of directors) {
      await createNotification({ userId: d.id, title: "Welfare Loan Awaiting Director Approval", message: `${loan.member.user.name} loan of KES ${loan.principalAmount.toLocaleString()} approved by Head Teacher. Awaiting your confirmation.`, type: "ACTION", link: "/welfare", actionRequired: true });
    }
    return NextResponse.json({ ok: true });
  }

  // Director approves PENDING_DIRECTOR → disburse
  if (parsed.data.action === "approve" && loan.status === "PENDING_DIRECTOR") {
    if (user.role !== "DIRECTOR") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    await db.welfareLoan.update({ where: { id: loan.id }, data: { status: "APPROVED", directorNotes: parsed.data.notes ?? null } });
    await createNotification({ userId: loan.member.userId, title: "Loan Approved", message: `Your ${loan.type.toLowerCase().replace("_", " ")} of KES ${loan.principalAmount.toLocaleString()} has been approved. It will be disbursed shortly.`, type: "SUCCESS", link: "/welfare" });
    return NextResponse.json({ ok: true });
  }

  if (parsed.data.action === "reject") {
    if (!["HEAD_TEACHER", "DIRECTOR"].includes(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    await db.welfareLoan.update({ where: { id: loan.id }, data: { status: "REJECTED", ...(user.role === "HEAD_TEACHER" ? { headteacherNotes: parsed.data.notes ?? null } : { directorNotes: parsed.data.notes ?? null }) } });
    await createNotification({ userId: loan.member.userId, title: "Loan Application Rejected", message: `Your ${loan.type.toLowerCase().replace("_", " ")} of KES ${loan.principalAmount.toLocaleString()} was not approved. ${parsed.data.notes ?? ""}`, type: "WARNING", link: "/welfare" });
    return NextResponse.json({ ok: true });
  }

  if (parsed.data.action === "disburse" && loan.status === "APPROVED") {
    if (!["WELFARE_CHAIR", "DIRECTOR"].includes(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    await db.welfareLoan.update({ where: { id: loan.id }, data: { status: "DISBURSED", disbursedAt: new Date() } });
    await createNotification({ userId: loan.member.userId, title: "Loan Disbursed", message: `KES ${loan.principalAmount.toLocaleString()} has been disbursed to you. Monthly deduction: KES ${loan.monthlyDeduction.toLocaleString()}.`, type: "SUCCESS", link: "/welfare" });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Invalid action for current status" }, { status: 400 });
}
