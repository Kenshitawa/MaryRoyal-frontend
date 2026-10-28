import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { Prisma, Role } from "@prisma/client";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { assertCanInScope, canManageStaffTarget, canViewStaffStatutory, canEditStaffStatutory } from "@/lib/permissions";
import { readSession } from "@/lib/session";
import { staffCreateWizardSchema } from "@/lib/staff-validation";
import { stripStaffStatutoryFields } from "@/lib/staff-sanitization";

async function actor() {
  const token = (await cookies()).get("mary_session")?.value;
  const session = token ? await readSession(token) : null;
  if (!session) return null;
  const user = await db.user.findUnique({
    where: { id: session.id },
    select: { id: true, name: true, role: true, suspended: true, forcePasswordChange: true },
  });
  return user && !user.suspended && !user.forcePasswordChange ? user : null;
}

export async function GET(request: Request) {
  const user = await actor();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  try {
    assertCanInScope(user.role, "staff", "view", "school");
  } catch {
    await db.auditEvent.create({
      data: { actorId: user.id, action: "ACCESS_DENIED", entity: "StaffDirectory" },
    });
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() || "";
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

  if (q) {
    where.OR = [
      { name: { contains: q } },
      { email: { contains: q } },
      { staffNumber: { contains: q } },
      { tscNumber: { contains: q } },
      { phone: { contains: q } },
    ];
  }

  const staff = await db.user.findMany({
    where,
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      avatarUrl: true,
      role: true,
      suspended: true,
      staffNumber: true,
      tscNumber: true,
      employmentTitle: true,
      qualifications: true,
      createdAt: true,
      staffProfile: {
        select: {
          id: true,
          gender: true,
          dateOfBirth: true,
          nationalId: true,
          nationality: true,
          maritalStatus: true,
          alternatePhone: true,
          residenceAddress: true,
          county: true,
          dateJoined: true,
          employmentType: true,
          department: true,
          lineManager: true,
          probationEndDate: true,
          educationHistory: true,
          professionalQualifications: true,
          certificates: true,
          specializations: true,
          yearsOfExperience: true,
          previousEmployers: true,
          kraPin: true,
          nssfNumber: true,
          shaNumber: true,
          bankName: true,
          bankAccountName: true,
          bankAccountNumber: true,
          bankBranch: true,
        },
      },
    },
    orderBy: [{ role: "asc" }, { name: "asc" }],
  });

  const canSeeStatutory = canViewStaffStatutory(user.role);

  if (canSeeStatutory) {
    await db.auditEvent.create({
      data: {
        actorId: user.id,
        action: "STAFF_STATUTORY_VIEWED",
        entity: "StaffDirectory",
      },
    });
  }

  // Strip restricted fields for unauthorized viewers
  const sanitized = staff.map((member) => {
    if (!member.staffProfile) return member;
    if (!canSeeStatutory) {
      const safeProfile = stripStaffStatutoryFields(member.staffProfile);
      return { ...member, staffProfile: safeProfile };
    }
    return member;
  });

  return NextResponse.json({ staff: sanitized });
}

export async function POST(request: Request) {
  const user = await actor();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  try {
    assertCanInScope(user.role, "staff", "create", "school");
  } catch {
    await db.auditEvent.create({
      data: { actorId: user.id, action: "ACCESS_DENIED", entity: "StaffCreate" },
    });
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON request." }, { status: 400 });
  }

  const parsed = staffCreateWizardSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validation failed.",
        issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
      },
      { status: 400 }
    );
  }

  const data = parsed.data;

  // Enforce staff target management: Head Teacher cannot create Director or Head Teacher
  if (!canManageStaffTarget(user.role, data.employment.role)) {
    await db.auditEvent.create({
      data: {
        actorId: user.id,
        action: "ACCESS_DENIED",
        entity: "StaffCreate",
        entityId: data.employment.role,
      },
    });
    return NextResponse.json(
      { error: "You are not authorized to create an account for this role." },
      { status: 403 }
    );
  }

  // Check email uniqueness
  const existing = await db.user.findUnique({
    where: { email: data.personal.email },
  });
  if (existing) {
    return NextResponse.json(
      { error: "A user with this email address already exists." },
      { status: 409 }
    );
  }

  // Generate temporary password
  const temporaryPassword = randomBytes(12).toString("base64url");
  const passwordHash = await bcrypt.hash(temporaryPassword, 12);

  try {
    const created = await db.$transaction(async (tx) => {
      // Create user record
      const newUser = await tx.user.create({
        data: {
          name: data.personal.name,
          email: data.personal.email,
          phone: data.personal.phone || null,
          role: data.employment.role,
          staffNumber: data.employment.staffNumber || null,
          tscNumber: data.employment.tscNumber || null,
          employmentTitle: data.employment.employmentTitle || null,
          avatarUrl: data.personal.avatarUrl || null,
          passwordHash,
          forcePasswordChange: true,
          qualifications: data.qualifications?.professionalQualifications || null,
        },
      });

      // Statutory permission check: can actor edit statutory?
      const canEditStat = canEditStaffStatutory(user.role, data.employment.role);

      // Create staff profile
      const profile = await tx.staffProfile.create({
        data: {
          userId: newUser.id,
          gender: data.personal.gender || null,
          dateOfBirth: data.personal.dateOfBirth ? new Date(data.personal.dateOfBirth) : null,
          nationalId: data.personal.nationalId || null,
          nationality: data.personal.nationality,
          maritalStatus: data.personal.maritalStatus || null,
          alternatePhone: data.personal.alternatePhone || null,
          residenceAddress: data.personal.residenceAddress || null,
          county: data.personal.county || null,
          dateJoined: data.employment.dateJoined ? new Date(data.employment.dateJoined) : new Date(),
          employmentType: data.employment.employmentType || "Permanent",
          department: data.employment.department || null,
          lineManager: data.employment.lineManager || null,
          probationEndDate: data.employment.probationEndDate ? new Date(data.employment.probationEndDate) : null,
          educationHistory: data.qualifications?.educationHistory || null,
          professionalQualifications: data.qualifications?.professionalQualifications || null,
          certificates: data.qualifications?.certificates || null,
          specializations: data.qualifications?.specializations || null,
          yearsOfExperience: data.qualifications?.yearsOfExperience || null,
          previousEmployers: data.qualifications?.previousEmployers || null,
          kraPin: canEditStat ? data.statutory?.kraPin || null : null,
          nssfNumber: canEditStat ? data.statutory?.nssfNumber || null : null,
          shaNumber: canEditStat ? data.statutory?.shaNumber || null : null,
          bankName: canEditStat ? data.statutory?.bankName || null : null,
          bankAccountName: canEditStat ? data.statutory?.bankAccountName || null : null,
          bankAccountNumber: canEditStat ? data.statutory?.bankAccountNumber || null : null,
          bankBranch: canEditStat ? data.statutory?.bankBranch || null : null,
        },
      });

      // Create emergency contacts
      for (const ec of data.emergencyContacts) {
        await tx.staffEmergencyContact.create({
          data: {
            staffProfileId: profile.id,
            fullName: ec.fullName,
            relationship: ec.relationship,
            phone: ec.phone,
            isNextOfKin: ec.isNextOfKin,
          },
        });
      }

      // Create referees
      if (data.referees && data.referees.length > 0) {
        for (const ref of data.referees) {
          await tx.staffReferee.create({
            data: {
              staffProfileId: profile.id,
              fullName: ref.fullName,
              organization: ref.organization,
              title: ref.title || null,
              phone: ref.phone,
              email: ref.email || null,
            },
          });
        }
      }

      // Create documents
      if (data.documentKeys && data.documentKeys.length > 0) {
        for (const doc of data.documentKeys) {
          await tx.staffDocument.create({
            data: {
              staffProfileId: profile.id,
              category: doc.category,
              storageKey: doc.storageKey,
              originalName: doc.originalName,
              contentType: doc.contentType,
              sizeBytes: doc.sizeBytes,
              uploadedById: user.id,
            },
          });
        }
      }

      // Create teaching assignments if teacher
      if (data.employment.role === Role.TEACHER && data.employment.assignedSubjects) {
        for (const asgn of data.employment.assignedSubjects) {
          await tx.teacherAssignment.upsert({
            where: {
              teacherId_grade_subject: {
                teacherId: newUser.id,
                grade: asgn.grade,
                subject: asgn.subject,
              },
            },
            create: {
              teacherId: newUser.id,
              grade: asgn.grade,
              subject: asgn.subject,
            },
            update: {},
          });
        }
      }

      if (data.employment.role === Role.TEACHER && data.employment.classTeacherGrade) {
        await tx.classTeacherAssignment.upsert({
          where: { grade: data.employment.classTeacherGrade },
          create: {
            teacherId: newUser.id,
            grade: data.employment.classTeacherGrade,
          },
          update: {
            teacherId: newUser.id,
          },
        });
      }

      // Audit event
      await tx.auditEvent.create({
        data: {
          actorId: user.id,
          action: "STAFF_ACCOUNT_CREATED",
          entity: "StaffProfile",
          entityId: newUser.id,
        },
      });

      return newUser;
    });

    return NextResponse.json(
      {
        success: true,
        user: {
          id: created.id,
          name: created.name,
          email: created.email,
          role: created.role,
        },
        temporaryPassword,
      },
      { status: 201 }
    );
  } catch {
    console.error("Staff creation failed.");
    return NextResponse.json(
      { error: "Could not create staff account. Please verify input data." },
      { status: 500 }
    );
  }
}
