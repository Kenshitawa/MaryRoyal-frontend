import type { Prisma } from "@prisma/client";

/**
 * Full account removal.
 *
 * The account row and everything that belongs to it (guardian links,
 * notifications, welfare membership, staff profile and its documents/history)
 * are removed by the database cascade. School records that merely *refer* to
 * the person (finance, assessments, admissions, audit, etc.) must survive, so
 * their actor/creator references are transferred to the Director performing
 * the deletion. Optional references are cleared instead of being fabricated.
 *
 * This is intentionally explicit: SQLite/PostgreSQL will reject a plain
 * `user.delete()` while any of these references exist.
 */
type ModelDelegate = {
  updateMany(args: { where: Record<string, string>; data: Record<string, string | null> }): Promise<{ count: number }>;
  deleteMany(args: { where: Record<string, string> }): Promise<{ count: number }>;
};

const REASSIGN_TO_ACTOR: ReadonlyArray<readonly [model: string, field: string]> = [
  ["assessment", "enteredById"],
  ["assessmentHistory", "actorId"],
  ["feeInvoice", "createdById"],
  ["feePayment", "recordedById"],
  ["feePaymentHistory", "actorId"],
  ["feeExpense", "enteredById"],
  ["payrollEntry", "staffId"],
  ["payrollEntry", "enteredById"],
  ["payrollHistory", "actorId"],
  ["teachingLog", "teacherId"],
  ["assignment", "teacherId"],
  ["learningResource", "teacherId"],
  ["complaint", "openedById"],
  ["complaintReply", "authorId"],
  ["diaryEntry", "authorId"],
  ["diaryReply", "authorId"],
  ["admissionDraft", "createdById"],
  ["admissionDocument", "uploadedById"],
  ["learningVideo", "addedById"],
  ["feeStructure", "createdById"],
  ["disciplineIncident", "recordedById"],
  ["examSession", "createdById"],
  ["cbcRubric", "createdById"],
  ["feeWaiver", "requestedById"],
  ["textbook", "createdById"],
  ["textbookIssue", "teacherId"],
  ["textbookIssue", "issuedById"],
  ["schemeOfWork", "teacherId"],
  ["schoolTimetable", "createdById"],
  ["welfareContribution", "recordedById"],
  ["welfareProduct", "createdById"],
  ["staffDocument", "uploadedById"],
  ["staffHistory", "actorId"],
  ["staffDraft", "createdById"],
  // Attendance rows owned by the target are deleted below, but rows recorded
  // by the target for other staff must remain and retain their audit trail.
  ["staffAttendance", "recordedById"],
];

const CLEAR_OPTIONAL: ReadonlyArray<readonly [model: string, field: string]> = [
  ["auditEvent", "actorId"],
  ["complaint", "assignedToId"],
  ["feeWaiver", "approvedById"],
  ["textbookRequest", "reviewedById"],
  ["schoolTimetable", "verifiedById"],
];

// Records that cannot be reassigned because a unique key includes the user
// reference; they are removed with the account instead.
const DELETE_OWNED: ReadonlyArray<readonly [model: string, field: string]> = [
  ["staffAttendance", "staffId"],
  ["learningVideoWatch", "userId"],
];

export async function deleteUserFully(
  tx: Prisma.TransactionClient,
  targetId: string,
  actorId: string,
): Promise<void> {
  const delegates = tx as unknown as Record<string, ModelDelegate | undefined>;

  for (const [model, field] of REASSIGN_TO_ACTOR) {
    const delegate = delegates[model];
    if (!delegate) continue;
    await delegate.updateMany({
      where: { [field]: targetId },
      data: { [field]: actorId },
    });
  }

  for (const [model, field] of CLEAR_OPTIONAL) {
    const delegate = delegates[model];
    if (!delegate) continue;
    await delegate.updateMany({
      where: { [field]: targetId },
      data: { [field]: null },
    });
  }

  for (const [model, field] of DELETE_OWNED) {
    const delegate = delegates[model];
    if (!delegate) continue;
    await delegate.deleteMany({ where: { [field]: targetId } });
  }

  // Remaining relations are onDelete: Cascade and go with the user.
  await tx.user.delete({ where: { id: targetId } });
}
