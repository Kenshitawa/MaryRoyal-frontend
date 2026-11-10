import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { readSession } from "@/lib/session";
import { canInScope } from "@/lib/permissions";
import { cbcLevel } from "@/lib/grading";

function escapeCsv(value: string | number | null | undefined): string {
  const str = String(value ?? "").replace(/[\r\n]/g, " ");
  const escaped = /^[=+\-@\t]/.test(str) ? `'${str}` : str;
  return `"${escaped.replaceAll('"', '""')}"`;
}

export async function GET() {
  const token = (await cookies()).get("school_session")?.value;
  const session = token ? await readSession(token) : null;
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const user = await db.user.findUnique({
    where: { id: session.id },
    select: { id: true, role: true, suspended: true, forcePasswordChange: true }
  });
  if (!user || user.suspended || user.forcePasswordChange) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  if (!canInScope(user.role, "exports", "view", "school")) {
    await db.auditEvent.create({
      data: { actorId: user.id, action: "ACCESS_DENIED", entity: "AssessmentExport" }
    });
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const assessments = await db.assessment.findMany({
    where: { status: "RELEASED" },
    include: {
      learner: { select: { admissionNo: true, name: true, grade: true } }
    },
    orderBy: [{ term: "desc" }, { subject: "asc" }, { createdAt: "desc" }]
  });

  await db.auditEvent.create({
    data: {
      actorId: user.id,
      action: "DATA_EXPORTED",
      entity: "Assessment",
      entityId: String(assessments.length)
    }
  });

  const headers = [
    "Admission Number",
    "Learner Name",
    "Class / Grade",
    "Subject",
    "Term",
    "Score (%)",
    "CBC Performance Level",
    "Strand",
    "Competency",
    "Teacher Remark",
    "Date Recorded"
  ];

  const rows = assessments.map((a) => [
    escapeCsv(a.learner.admissionNo),
    escapeCsv(a.learner.name),
    escapeCsv(a.learner.grade),
    escapeCsv(a.subject),
    escapeCsv(a.term),
    escapeCsv(a.score),
    escapeCsv(cbcLevel(a.score)),
    escapeCsv(a.strand ?? "â€”"),
    escapeCsv(a.competency ?? "â€”"),
    escapeCsv(a.comment ?? "â€”"),
    escapeCsv(new Intl.DateTimeFormat("en-KE", { dateStyle: "short", timeZone: "Africa/Nairobi" }).format(a.createdAt))
  ].join(","));

  const csv = [headers.join(","), ...rows].join("\r\n");

  return new Response(`\uFEFF${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=Mary-Royal-Released-Assessments.csv",
      "Cache-Control": "private, no-store"
    }
  });
}
