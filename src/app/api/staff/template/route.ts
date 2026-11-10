import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { canInScope } from "@/lib/permissions";
import { readSession } from "@/lib/session";

export async function GET() {
  const token = (await cookies()).get("school_session")?.value;
  const session = token ? await readSession(token) : null;
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const user = await db.user.findUnique({
    where: { id: session.id },
    select: { role: true },
  });
  if (!user || !canInScope(user.role, "staff", "view", "school")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const headers = [
    "Full Name",
    "Role (TEACHER, SECRETARY, ACCOUNTANT, DEPUTY)",
    "Email",
    "Phone (+254...)",
    "Staff Number",
    "TSC Number",
    "Job Title",
    "Department",
    "Employment Type (Permanent, Contract, BOM, Part-Time)",
    "National ID",
    "KRA PIN",
    "NSSF Number",
    "SHA Number",
    "Bank Name",
    "Bank Account Number",
  ];

  const sampleRow = [
    "Grace Achieng",
    "TEACHER",
    "grace.achieng@maryroyal.ac.ke",
    "+254712345678",
    "MR-ST-09",
    "TSC-789012",
    "Primary Teacher",
    "Languages",
    "Permanent",
    "28901234",
    "A012345678Z",
    "NSSF-34567",
    "SHA-98765",
    "KCB Bank",
    "1234567890",
  ];

  const csv = "\uFEFF" + [headers.join(","), sampleRow.join(",")].join("\r\n");

  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="mary_royal_staff_import_template.csv"',
    },
  });
}
