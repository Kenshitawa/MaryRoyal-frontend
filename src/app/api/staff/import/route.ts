import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { Role } from "@prisma/client";
import { db } from "@/lib/db";
import { canInScope, canManageStaffTarget } from "@/lib/permissions";
import { readSession } from "@/lib/session";
import { kenyanPhoneRegex } from "@/lib/staff-validation";

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

interface StaffImportRow {
  rowNum: number;
  name: string;
  role: string;
  email: string;
  phone: string;
  staffNumber: string;
  tscNumber: string;
  employmentTitle: string;
  department: string;
  employmentType: string;
  nationalId: string;
  kraPin: string;
  nssfNumber: string;
  shaNumber: string;
  bankName: string;
  bankAccountNumber: string;
}

function parseCSVLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let insideQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (insideQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === "," && !insideQuotes) {
      values.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  values.push(current.trim());
  return values;
}

export async function POST(request: Request) {
  const user = await actor();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  if (!canInScope(user.role, "staff", "create", "school")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const action = (formData.get("action") as string) || "preview"; // "preview" | "commit"

  if (!file) return NextResponse.json({ error: "No CSV file uploaded." }, { status: 400 });

  const text = await file.text();
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  if (lines.length < 2) {
    return NextResponse.json({ error: "CSV file is empty or missing data rows." }, { status: 400 });
  }

  // Header row
  const parsedRows: StaffImportRow[] = [];
  const errors: { row: number; field: string; message: string }[] = [];

  const existingEmails = new Set(
    (await db.user.findMany({ select: { email: true } })).map((u) => u.email.toLowerCase())
  );
  const seenBatchEmails = new Set<string>();

  for (let i = 1; i < lines.length; i++) {
    const rowNum = i + 1;
    const cols = parseCSVLine(lines[i]);
    if (cols.length < 3 || cols.every((c) => !c)) continue; // skip blank line

    const name = cols[0];
    const roleStr = cols[1]?.toUpperCase().replace(/\s+/g, "_") || "TEACHER";
    const email = cols[2]?.toLowerCase() || "";
    const phone = cols[3] || "";
    const staffNumber = cols[4] || "";
    const tscNumber = cols[5] || "";
    const employmentTitle = cols[6] || "";
    const department = cols[7] || "";
    const employmentType = cols[8] || "Permanent";
    const nationalId = cols[9] || "";
    const kraPin = cols[10] || "";
    const nssfNumber = cols[11] || "";
    const shaNumber = cols[12] || "";
    const bankName = cols[13] || "";
    const bankAccountNumber = cols[14] || "";

    if (!name || name.length < 2) {
      errors.push({ row: rowNum, field: "Full Name", message: "Name must be at least 2 characters." });
    }

    if (!Object.values(Role).includes(roleStr as Role)) {
      errors.push({ row: rowNum, field: "Role", message: `Invalid role "${roleStr}".` });
    } else {
      const role = roleStr as Role;
      if (!canManageStaffTarget(user.role, role)) {
        errors.push({ row: rowNum, field: "Role", message: `You are not permitted to create a ${role}.` });
      }
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push({ row: rowNum, field: "Email", message: "Valid email is required." });
    } else if (existingEmails.has(email)) {
      errors.push({ row: rowNum, field: "Email", message: `Email "${email}" already registered in system.` });
    } else if (seenBatchEmails.has(email)) {
      errors.push({ row: rowNum, field: "Email", message: `Duplicate email "${email}" in CSV file.` });
    } else {
      seenBatchEmails.add(email);
    }

    if (phone && !kenyanPhoneRegex.test(phone)) {
      errors.push({ row: rowNum, field: "Phone", message: "Phone must be in +254 or 07/01 format." });
    }

    parsedRows.push({
      rowNum,
      name,
      role: roleStr,
      email,
      phone,
      staffNumber,
      tscNumber,
      employmentTitle,
      department,
      employmentType,
      nationalId,
      kraPin,
      nssfNumber,
      shaNumber,
      bankName,
      bankAccountNumber,
    });
  }

  if (action === "preview") {
    return NextResponse.json({
      validCount: parsedRows.length - errors.length,
      totalCount: parsedRows.length,
      errors,
      preview: parsedRows.slice(0, 10),
    });
  }

  // Commit action
  if (errors.length > 0) {
    return NextResponse.json(
      { error: "Cannot import file with validation errors. Please fix errors and re-upload.", errors },
      { status: 400 }
    );
  }

  const createdRecords: { name: string; email: string; role: string; temporaryPassword: string }[] = [];
  await db.$transaction(async (tx) => {
    for (const r of parsedRows) {
      const tempPass = randomBytes(12).toString("base64url");
      const hash = await bcrypt.hash(tempPass, 12);

      const newUser = await tx.user.create({
        data: {
          name: r.name,
          email: r.email,
          phone: r.phone || null,
          role: r.role as Role,
          staffNumber: r.staffNumber || null,
          tscNumber: r.tscNumber || null,
          employmentTitle: r.employmentTitle || null,
          passwordHash: hash,
          forcePasswordChange: true,
        },
      });

      await tx.staffProfile.create({
        data: {
          userId: newUser.id,
          nationalId: r.nationalId || null,
          department: r.department || null,
          employmentType: r.employmentType || "Permanent",
          kraPin: r.kraPin || null,
          nssfNumber: r.nssfNumber || null,
          shaNumber: r.shaNumber || null,
          bankName: r.bankName || null,
          bankAccountNumber: r.bankAccountNumber || null,
        },
      });

      createdRecords.push({
        name: r.name,
        email: r.email,
        role: r.role,
        temporaryPassword: tempPass,
      });
    }

    await tx.auditEvent.create({
      data: {
        actorId: user.id,
        action: "STAFF_BULK_IMPORTED",
        entity: "StaffProfile",
        entityId: `${createdRecords.length} accounts`,
      },
    });
  });

  return NextResponse.json({
    success: true,
    count: createdRecords.length,
    credentials: createdRecords,
  });
}
