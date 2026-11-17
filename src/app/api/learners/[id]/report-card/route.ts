import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { db } from "@/lib/db";
import { canInScope } from "@/lib/permissions";
import { readSession } from "@/lib/session";
import { buildReportCardPdf } from "@/lib/report-card-pdf";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = (await cookies()).get("mary_session")?.value;
  const session = token ? await readSession(token) : null;
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const user = await db.user.findUnique({
    where: { id: session.id },
    select: { id: true, role: true, suspended: true, forcePasswordChange: true }
  });
  if (!user || user.suspended || user.forcePasswordChange) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const termResult = z.string().trim().min(1).max(40).optional().safeParse(
    new URL(request.url).searchParams.get("term") ?? undefined
  );
  if (!termResult.success) return NextResponse.json({ error: "Invalid term." }, { status: 400 });

  const idResult = z.string().min(1).max(80).safeParse((await params).id);
  if (!idResult.success) return NextResponse.json({ error: "Learner record not found." }, { status: 404 });
  const id = idResult.data;
  const schoolScope = canInScope(user.role, "assessments", "view", "school");
  const assignedScope = canInScope(user.role, "assessments", "view", "assigned");
  const linkedScope = canInScope(user.role, "assessments", "view", "linked");
  const ownScope = canInScope(user.role, "assessments", "view", "self");
  if (!schoolScope && !assignedScope && !linkedScope && !ownScope) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const learner = await db.learner.findFirst({
    where: { id, archivedAt: null },
    select: { id: true, name: true, admissionNo: true, grade: true }
  });
  if (!learner) return NextResponse.json({ error: "Learner record not found." }, { status: 404 });

  let assignedSubjects: string[] | undefined;
  if (assignedScope) {
    const assignments = await db.teacherAssignment.findMany({
      where: { teacherId: user.id, grade: learner.grade },
      select: { subject: true }
    });
    if (assignments.length === 0) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    assignedSubjects = assignments.map((assignment) => assignment.subject);
  } else if (linkedScope) {
    const link = await db.guardianLink.findFirst({
      where: { userId: user.id, learnerId: learner.id, relation: { not: "Learner" } },
      select: { id: true }
    });
    if (!link) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  } else if (ownScope) {
    const link = await db.guardianLink.findFirst({
      where: { userId: user.id, learnerId: learner.id, relation: "Learner" },
      select: { id: true }
    });
    if (!link) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const assessments = await db.assessment.findMany({
    where: {
      learnerId: learner.id,
      status: "RELEASED",
      ...(assignedSubjects ? { subject: { in: assignedSubjects } } : {})
    },
    select: { subject: true, score: true, comment: true, term: true },
    orderBy: [{ term: "desc" }, { subject: "asc" }]
  });
  const allTerms = [...new Set(assessments.map((assessment) => assessment.term))];
  const targetTerm = termResult.data ?? allTerms[0];
  if (!targetTerm || !allTerms.includes(targetTerm)) {
    return NextResponse.json({ error: "No released assessments are available for that term." }, { status: 404 });
  }
  const termAssessments = assessments
    .filter((assessment) => assessment.term === targetTerm)
    .map(({ subject, score, comment }) => ({ subject, score, comment }));

  const logoBytes = await readFile(join(process.cwd(), "public", "mary-royal-logo.png"));
  const pdfBytes = await buildReportCardPdf({
    learner,
    term: targetTerm,
    assessments: termAssessments,
    logoBytes
  });
  await db.auditEvent.create({
    data: {
      actorId: user.id,
      action: "REPORT_CARD_EXPORTED",
      entity: "Learner",
      entityId: learner.id
    }
  });
  const filenameSegment = (value: string) => value.replace(/[^a-zA-Z0-9_-]+/g, "_").slice(0, 60);
  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="MaryRoyal-ReportCard-${filenameSegment(targetTerm)}-${filenameSegment(learner.admissionNo)}.pdf"`,
      "Cache-Control": "private, no-store"
    }
  });
}
