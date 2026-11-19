import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { Prisma, Role } from "@prisma/client";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { assertCan } from "@/lib/permissions";
import { readSession } from "@/lib/session";
import { createStaffWelfareMember } from "@/lib/welfare";
import { deleteUserFully } from "@/lib/account-deletion";

async function actor() {
  const token = (await cookies()).get("mary_session")?.value;
  const session = token ? await readSession(token) : null;
  if (!session) return null;

  const user = await db.user.findUnique({
    where: { id: session.id },
    select: { id: true, role: true, suspended: true, forcePasswordChange: true },
  });
  return user && !user.suspended && !user.forcePasswordChange ? user : null;
}

const createSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  role: z.nativeEnum(Role),
  staffNumber: z.string().trim().max(40).optional().default(""),
  tscNumber: z.string().trim().max(40).optional().default(""),
  qualifications: z.string().trim().max(500).optional().default(""),
  employmentTitle: z.string().trim().max(100).optional().default(""),
  learnerId: z.string().trim().min(1).optional(),
}).superRefine((value, context) => {
  if (
    (value.role === Role.PARENT || value.role === Role.LEARNER) &&
    (value.staffNumber || value.tscNumber || value.qualifications || value.employmentTitle)
  ) {
    context.addIssue({ code: "custom", message: "Employment details are only valid for staff accounts." });
  }
  if (value.role === Role.LEARNER && !value.learnerId) {
    context.addIssue({ code: "custom", path: ["learnerId"], message: "Select the learner record this account belongs to." });
  }
  if (value.role !== Role.LEARNER && value.learnerId) {
    context.addIssue({ code: "custom", path: ["learnerId"], message: "A learner record can only be linked to a learner account." });
  }
});

export async function GET() {
  const user = await actor();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  try {
    assertCan(user.role, "accounts", "view");
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const accounts = await db.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      suspended: true,
      suspensionReason: true,
      forcePasswordChange: true,
      failedLogins: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return NextResponse.json({ accounts });
}

export async function POST(request: Request) {
  const user = await actor();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  try {
    assertCan(user.role, "accounts", "create");
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid name, email and role." }, { status: 400 });

  const temporaryPassword = randomBytes(12).toString("base64url");
  try {
    const account = await db.$transaction(async (tx) => {
      const { learnerId, ...accountData } = parsed.data;
      const learner = parsed.data.role === Role.LEARNER && learnerId
        ? await tx.learner.findUnique({ where: { id: learnerId }, select: { id: true, name: true, archivedAt: true } })
        : null;
      if (parsed.data.role === Role.LEARNER && (!learner || learner.archivedAt)) {
        throw new Error("LEARNER_PROFILE_NOT_FOUND");
      }
      if (learner) {
        const existingLogin = await tx.guardianLink.findFirst({ where: { learnerId: learner.id, relation: "Learner" }, select: { id: true } });
        if (existingLogin) throw new Error("LEARNER_LOGIN_EXISTS");
      }
      const created = await tx.user.create({
        data: {
          ...accountData,
          ...(learner ? { name: learner.name } : {}),
          passwordHash: await bcrypt.hash(temporaryPassword, 12),
          forcePasswordChange: true,
        },
      });
      if (learner) {
        await tx.guardianLink.create({ data: { userId: created.id, learnerId: learner.id, relation: "Learner" } });
        await tx.auditEvent.create({ data: { actorId: user.id, action: "LEARNER_ACCOUNT_LINKED", entity: "Learner", entityId: learner.id } });
      }
      await createStaffWelfareMember(tx, created.id, created.role, user.id);
      await tx.auditEvent.create({
        data: { actorId: user.id, action: "ACCOUNT_CREATED", entity: "User", entityId: created.id },
      });
      return created;
    });
    return NextResponse.json({
      account: { id: account.id, name: account.name, email: account.email, role: account.role },
      temporaryPassword,
    }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "LEARNER_PROFILE_NOT_FOUND") {
      return NextResponse.json({ error: "The selected learner record is unavailable. Refresh the directory and select an active learner." }, { status: 404 });
    }
    if (error instanceof Error && error.message === "LEARNER_LOGIN_EXISTS") {
      return NextResponse.json({ error: "This learner already has a portal account. Use the existing account and learner link." }, { status: 409 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "An account with that email already exists." }, { status: 409 });
    }
    throw error;
  }
}

const actionSchema = z.object({
  id: z.string().min(1),
  action: z.enum(["suspend", "archive", "reactivate", "reset-password", "unlock", "delete"]),
});

export async function PATCH(request: Request) {
  const user = await actor();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  try {
    assertCan(user.role, "accounts", "update");
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid account change." }, { status: 400 });
  const { id, action } = parsed.data;

  if (id === user.id && ["suspend", "archive", "delete"].includes(action)) {
    return NextResponse.json({ error: "You cannot remove access to your own account." }, { status: 400 });
  }
  if (action === "archive" && user.role !== Role.DIRECTOR) {
    return NextResponse.json({ error: "Only the Director can archive an account." }, { status: 403 });
  }
  if (action === "delete" && user.role !== Role.DIRECTOR) {
    return NextResponse.json({ error: "Only the Director can delete an account." }, { status: 403 });
  }

  if (action === "delete") {
    const target = await db.user.findUnique({ where: { id }, select: { role: true } });
    if (!target) return NextResponse.json({ error: "Account not found." }, { status: 404 });
    if (target.role === Role.DIRECTOR) {
      return NextResponse.json({ error: "A Director account cannot be deleted." }, { status: 403 });
    }

    try {
      await db.$transaction(async (tx) => {
        await deleteUserFully(tx, id, user.id);
        await tx.auditEvent.create({
          data: { actorId: user.id, action: "ACCOUNT_DELETED", entity: "User", entityId: id },
        });
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        ["P2003", "P2014"].includes(error.code)
      ) {
        return NextResponse.json(
          { error: "Account could not be deleted because linked records still need to be resolved." },
          { status: 409 },
        );
      }
      throw error;
    }
    return NextResponse.json({ ok: true });
  }

  const temporaryPassword = action === "reset-password" ? randomBytes(12).toString("base64url") : null;
  try {
    const account = await db.$transaction(async (tx) => {
      const data = action === "suspend"
        ? { suspended: true, suspensionReason: "DIRECTOR" }
        : action === "archive"
          ? { suspended: true, suspensionReason: "ARCHIVED" }
          : action === "reactivate"
            ? { suspended: false, suspensionReason: null }
            : action === "unlock"
              ? { failedLogins: 0 }
              : { passwordHash: await bcrypt.hash(temporaryPassword!, 12), failedLogins: 0, forcePasswordChange: true };
      const updated = await tx.user.update({ where: { id }, data });
      await tx.auditEvent.create({
        data: {
          actorId: user.id,
          action: action === "archive" ? "ACCOUNT_ARCHIVED" : action.toUpperCase().replaceAll("-", "_"),
          entity: "User",
          entityId: updated.id,
        },
      });
      return updated;
    });
    return NextResponse.json({
      account: {
        id: account.id,
        suspended: account.suspended,
        suspensionReason: account.suspensionReason,
        failedLogins: account.failedLogins,
        forcePasswordChange: account.forcePasswordChange,
      },
      ...(temporaryPassword ? { temporaryPassword } : {}),
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ error: "Account not found." }, { status: 404 });
    }
    throw error;
  }
}
