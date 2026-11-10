import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { Prisma, Role } from "@prisma/client";
import { db } from "@/lib/db";
import { canInScope, canViewStaffStatutory } from "@/lib/permissions";
import { readSession } from "@/lib/session";

async function actor() {
  const token = (await cookies()).get("school_session")?.value;
  const session = token ? await readSession(token) : null;
  if (!session) return null;
  const user = await db.user.findUnique({
    where: { id: session.id },
    select: { id: true, name: true, role: true, suspended: true, forcePasswordChange: true },
  });
  return user && !user.suspended && !user.forcePasswordChange ? user : null;
}

function sanitizeCsv(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '""';
  let str = String(value);
  // Prevent CSV injection if starting with formula triggers
  if (/^[=+\-@\t\r]/.test(str)) {
    str = "'" + str;
  }
  return `"${str.replaceAll('"', '""')}"`;
}

export async function GET(request: Request) {
  const user = await actor();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  if (!canInScope(user.role, "staff", "view", "school")) {
    await db.auditEvent.create({
      data: { actorId: user.id, action: "ACCESS_DENIED", entity: "StaffExport" },
    });
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const roleFilter = searchParams.get("role")?.trim();
  const statusFilter = searchParams.get("status")?.trim();

  const where: Prisma.UserWhereInput = {
    role: { notIn: [Role.PARENT, Role.LEARNER] },
  };

  if (roleFilter && roleFilter !== "ALL" && Object.values(Role).includes(roleFilter as Role)) {
    where.role = roleFilter as Role;
  }

  if (statusFilter === "ACTIVE") {
    where.suspended = false;
  } else if (statusFilter === "SUSPENDED") {
    where.suspended = true;
  }

  const staff = await db.user.findMany({
    where,
    include: {
      staffProfile: true,
    },
    orderBy: [{ role: "asc" }, { name: "asc" }],
  });

  const canSeeStatutory = canViewStaffStatutory(user.role);

  // Headers
  const baseHeaders = [
    "Staff ID",
    "Full Name",
    "Role",
    "Email",
    "Phone",
    "Staff Number",
    "TSC Number",
    "Job Title",
    "Department",
    "Employment Type",
    "Date Joined",
    "Status",
  ];

  const statutoryHeaders = [
    "National ID",
    "KRA PIN",
    "NSSF Number",
    "SHA Number",
    "Bank Name",
    "Bank Account Name",
    "Bank Account Number",
    "Bank Branch",
  ];

  const headers = canSeeStatutory ? [...baseHeaders, ...statutoryHeaders] : baseHeaders;

  const rows = staff.map((s) => {
    const prof = s.staffProfile;
    const baseRow = [
      sanitizeCsv(s.id),
      sanitizeCsv(s.name),
      sanitizeCsv(s.role),
      sanitizeCsv(s.email),
      sanitizeCsv(s.phone || ""),
      sanitizeCsv(s.staffNumber || ""),
      sanitizeCsv(s.tscNumber || ""),
      sanitizeCsv(s.employmentTitle || ""),
      sanitizeCsv(prof?.department || ""),
      sanitizeCsv(prof?.employmentType || ""),
      sanitizeCsv(prof?.dateJoined ? prof.dateJoined.toISOString().split("T")[0] : ""),
      sanitizeCsv(s.suspended ? "Suspended" : "Active"),
    ];

    if (!canSeeStatutory) return baseRow.join(",");

    const statRow = [
      sanitizeCsv(prof?.nationalId || ""),
      sanitizeCsv(prof?.kraPin || ""),
      sanitizeCsv(prof?.nssfNumber || ""),
      sanitizeCsv(prof?.shaNumber || ""),
      sanitizeCsv(prof?.bankName || ""),
      sanitizeCsv(prof?.bankAccountName || ""),
      sanitizeCsv(prof?.bankAccountNumber || ""),
      sanitizeCsv(prof?.bankBranch || ""),
    ];

    return [...baseRow, ...statRow].join(",");
  });

  const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\r\n");

  await db.auditEvent.create({
    data: {
      actorId: user.id,
      action: "STAFF_CSV_EXPORTED",
      entity: "StaffProfile",
    },
  });

  if (canSeeStatutory) {
    await db.auditEvent.create({
      data: {
        actorId: user.id,
        action: "STAFF_STATUTORY_VIEWED",
        entity: "StaffExport",
      },
    });
  }

  return new Response(csvContent, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="mary_royal_staff_${new Date().toISOString().split("T")[0]}.csv"`,
      "cache-control": "no-store",
    },
  });
}
