import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { ButtonLink } from "@/components/base/buttons/button";
import { StatusPill } from "@/components/design-system/status-pill";
import { Card, EmptyState, ListRow, PageHeader, StatCard } from "@/components/ui/primitives";
import { db } from "@/lib/db";
import { canInScope } from "@/lib/permissions";
import { readSession } from "@/lib/session";
import { cx } from "@/utils/cx";

const pageSize = 50;
const pageSchema = z.string().regex(/^[1-9]\d{0,2}$/).optional();

const kes = (value: number) =>
  new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 0
  }).format(value);

export default async function ReceiptsPage({
  searchParams
}: {
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  const token = (await cookies()).get("mary_session")?.value;
  const session = token ? await readSession(token) : null;
  if (!session) redirect("/");

  const user = await db.user.findUnique({
    where: { id: session.id },
    select: { id: true, role: true, suspended: true, forcePasswordChange: true }
  });
  if (!user || user.suspended) redirect("/");
  if (user.forcePasswordChange) redirect("/change-password");

  const schoolScope = canInScope(user.role, "payments", "view", "school");
  const linkedScope = canInScope(user.role, "payments", "view", "linked");
  if (!schoolScope && !linkedScope) redirect("/dashboard");

  const query = await searchParams;
  const parsedPage = pageSchema.safeParse(query.page);
  if (!parsedPage.success) notFound();
  const page = parsedPage.data ? Number(parsedPage.data) : 1;
  const skip = (page - 1) * pageSize;

  let linkedLearnerIds: string[] | undefined;
  if (linkedScope) {
    const links = await db.guardianLink.findMany({
      where: {
        userId: user.id,
        relation: { not: "Learner" },
        learner: { archivedAt: null }
      },
      select: { learnerId: true }
    });
    linkedLearnerIds = links.map((link) => link.learnerId);
  }

  const visibleWhere = {
    status: { not: "PENDING" },
    ...(linkedLearnerIds
      ? { invoice: { learnerId: { in: linkedLearnerIds } } }
      : {})
  };
  const confirmedWhere = {
    ...visibleWhere,
    status: { notIn: ["PENDING", "VOID"] }
  };

  const [receiptCount, collected, payments] = await Promise.all([
    db.feePayment.count({ where: visibleWhere }),
    db.feePayment.aggregate({
      where: confirmedWhere,
      _sum: { amount: true }
    }),
    db.feePayment.findMany({
      where: visibleWhere,
      select: {
        id: true,
        receiptNo: true,
        amount: true,
        method: true,
        status: true,
        createdAt: true,
        invoice: {
          select: {
            term: true,
            learner: {
              select: { name: true, admissionNo: true, grade: true }
            }
          }
        }
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip,
      take: pageSize + 1
    })
  ]);
  const visiblePayments = payments.slice(0, pageSize);
  const hasNext = payments.length > pageSize;
  const homeHref = user.role === "PARENT" ? "/portal" : "/finance";

  return (
    <div className="space-y-4">
      <PageHeader
        title="Official receipts"
        help="Browse confirmed payments and keep voided receipts available for reference."
        action={
          <ButtonLink href={homeHref} variant="secondary" size="small">
            {user.role === "PARENT" ? "Back to portal" : "Back to finance"}
          </ButtonLink>
        }
      />

      <section aria-label="Receipt summary" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <StatCard label="Receipts" value={receiptCount.toLocaleString("en-KE")} note="Confirmed and voided" />
        <StatCard label="Confirmed collection" value={kes(collected._sum.amount ?? 0)} note="Excludes pending and voided payments" />
      </section>

      <Card
        title="Receipt register"
        description="Select a receipt to view or print its full details."
        padded={false}
      >
        {visiblePayments.length === 0 ? (
          <EmptyState
            title="No receipts yet"
            description="Confirmed payments will appear here when they are available."
          />
        ) : (
          <nav aria-label="Official receipts" className="divide-y divide-separator-border">
            {visiblePayments.map((payment) => {
              const date = new Intl.DateTimeFormat("en-KE", {
                dateStyle: "medium",
                timeZone: "Africa/Nairobi"
              }).format(payment.createdAt);
              const learner = payment.invoice.learner;
              return (
                <ListRow
                  key={payment.id}
                  href={`/receipts/${payment.id}`}
                  className={cx(
                    "min-h-16 rounded-none px-4 py-3",
                    "outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring"
                  )}
                  title={payment.receiptNo}
                  subtitle={`${learner.name} · ${learner.admissionNo} · ${learner.grade} · ${payment.invoice.term} · ${date}`}
                  trailing={
                    <span className="flex flex-col items-end gap-1">
                      <span className="text-body-medium tabular-nums text-text-primary">{kes(payment.amount)}</span>
                      <StatusPill status={payment.status} />
                    </span>
                  }
                />
              );
            })}
          </nav>
        )}
      </Card>

      {(page > 1 || hasNext) && (
        <nav aria-label="Receipt pages" className="flex items-center justify-between gap-3">
          {page > 1 ? (
            <ButtonLink href={page === 2 ? "/receipts" : `/receipts?page=${page - 1}`} variant="secondary" size="small">
              Previous
            </ButtonLink>
          ) : <span />}
          <p className="text-body-2-regular text-text-secondary">Page {page}</p>
          {hasNext ? (
            <ButtonLink href={`/receipts?page=${page + 1}`} variant="secondary" size="small">
              Next
            </ButtonLink>
          ) : <span />}
        </nav>
      )}
    </div>
  );
}
