import { Role } from "@prisma/client";
export type Action = "view" | "create" | "update" | "delete" | "approve" | "review" | "release" | "submit" | "confirm" | "verify" | "apply";
export type Resource = "dashboard" | "accounts" | "staff" | "staffAttendance" | "learners" | "admissions" | "learnerAccounts" | "attendance" | "assessments" | "discipline" | "finance" | "invoices" | "payments" | "payroll" | "feeStructures" | "audit" | "operations" | "guardians" | "exports" | "teachingLogs" | "assignments" | "learning" | "learningVideos" | "complaints" | "examSessions" | "rubrics" | "feeWaivers" | "textbooks" | "schemesOfWork" | "timetable" | "welfare" | "notifications";
export type DataScope = "school" | "assigned" | "linked" | "self" | "learner-identity" | "academic" | "operations" | "finance";
const ALL_STAFF: Role[] = [Role.DIRECTOR, Role.HEAD_TEACHER, Role.DEPUTY, Role.SECRETARY, Role.ACCOUNTANT, Role.TEACHER, Role.WELFARE_CHAIR, Role.NON_TEACHING_STAFF];
const ALL: Role[] = [...ALL_STAFF, Role.PARENT, Role.LEARNER];
const matrix: Record<Resource, Partial<Record<Action, Role[]>>> = {
 dashboard: { view: ALL },
 accounts: { view: [Role.DIRECTOR], create: [Role.DIRECTOR], update: [Role.DIRECTOR], delete: [Role.DIRECTOR] },
 staff: { view: [Role.DIRECTOR, Role.HEAD_TEACHER, Role.DEPUTY, Role.SECRETARY, Role.ACCOUNTANT, Role.TEACHER], create: [Role.DIRECTOR, Role.HEAD_TEACHER], update: [Role.DIRECTOR, Role.HEAD_TEACHER], delete: [Role.DIRECTOR] },
 staffAttendance: { view: ALL_STAFF, create: [Role.DIRECTOR, Role.HEAD_TEACHER, Role.DEPUTY], update: [Role.DIRECTOR, Role.HEAD_TEACHER, Role.DEPUTY] },
 learners: { view: [Role.DIRECTOR, Role.HEAD_TEACHER, Role.DEPUTY, Role.SECRETARY, Role.TEACHER, Role.PARENT, Role.LEARNER, Role.ACCOUNTANT], update: [Role.HEAD_TEACHER, Role.SECRETARY], approve: [Role.HEAD_TEACHER], delete: [Role.DIRECTOR] },
 admissions: { view: [Role.DIRECTOR, Role.HEAD_TEACHER, Role.DEPUTY, Role.SECRETARY], create: [Role.DIRECTOR, Role.SECRETARY], update: [Role.DIRECTOR, Role.SECRETARY], submit: [Role.DIRECTOR, Role.SECRETARY], approve: [Role.HEAD_TEACHER], delete: [Role.DIRECTOR, Role.HEAD_TEACHER, Role.SECRETARY] },
 learnerAccounts: { create: [Role.DIRECTOR, Role.SECRETARY] },
 attendance: { view: [Role.DIRECTOR, Role.HEAD_TEACHER, Role.DEPUTY, Role.TEACHER, Role.PARENT, Role.LEARNER], create: [Role.DIRECTOR, Role.TEACHER], update: [Role.DIRECTOR, Role.TEACHER] },
 assessments: { view: [Role.DIRECTOR, Role.HEAD_TEACHER, Role.DEPUTY, Role.TEACHER, Role.PARENT, Role.LEARNER], create: [Role.TEACHER], update: [Role.TEACHER], approve: [Role.HEAD_TEACHER, Role.DIRECTOR], review: [Role.HEAD_TEACHER], release: [Role.DIRECTOR] },
 discipline: { view: [Role.DIRECTOR, Role.HEAD_TEACHER, Role.DEPUTY, Role.TEACHER, Role.PARENT], create: [Role.DIRECTOR, Role.HEAD_TEACHER, Role.DEPUTY], update: [Role.DIRECTOR, Role.HEAD_TEACHER, Role.DEPUTY] },
 finance: { view: [Role.DIRECTOR, Role.HEAD_TEACHER, Role.SECRETARY, Role.ACCOUNTANT, Role.PARENT] },
 invoices: { view: [Role.DIRECTOR, Role.HEAD_TEACHER, Role.SECRETARY, Role.ACCOUNTANT, Role.PARENT], create: [Role.ACCOUNTANT, Role.DIRECTOR] },
 payments: { view: [Role.DIRECTOR, Role.HEAD_TEACHER, Role.ACCOUNTANT, Role.PARENT], create: [Role.DIRECTOR, Role.HEAD_TEACHER, Role.ACCOUNTANT], update: [Role.ACCOUNTANT, Role.DIRECTOR], approve: [Role.HEAD_TEACHER, Role.DIRECTOR] },
 payroll: { view: [Role.DIRECTOR, Role.HEAD_TEACHER], create: [Role.HEAD_TEACHER], update: [Role.HEAD_TEACHER], approve: [Role.DIRECTOR] },
 feeStructures: { view: [Role.DIRECTOR, Role.HEAD_TEACHER, Role.SECRETARY, Role.ACCOUNTANT], create: [Role.DIRECTOR, Role.HEAD_TEACHER], update: [Role.DIRECTOR, Role.HEAD_TEACHER] },
 audit: { view: [Role.DIRECTOR, Role.HEAD_TEACHER] },
 operations: { view: [Role.DIRECTOR, Role.HEAD_TEACHER, Role.DEPUTY, Role.TEACHER], create: [Role.DIRECTOR, Role.DEPUTY, Role.TEACHER], update: [Role.DIRECTOR, Role.DEPUTY, Role.TEACHER] },
 guardians: { view: [Role.DIRECTOR], create: [Role.DIRECTOR], delete: [Role.DIRECTOR] },
 exports: { view: [Role.DIRECTOR] },
 teachingLogs: { view: [Role.DIRECTOR, Role.HEAD_TEACHER, Role.TEACHER], create: [Role.TEACHER], approve: [Role.DIRECTOR, Role.HEAD_TEACHER] },
 assignments: { view: [Role.TEACHER, Role.LEARNER], create: [Role.TEACHER], update: [Role.TEACHER] },
 learning: { view: [Role.TEACHER, Role.LEARNER], create: [Role.TEACHER, Role.LEARNER] },
 learningVideos: { view: [Role.DIRECTOR, Role.HEAD_TEACHER, Role.DEPUTY, Role.TEACHER, Role.LEARNER], create: [Role.DIRECTOR, Role.HEAD_TEACHER, Role.DEPUTY, Role.TEACHER], update: [Role.DIRECTOR, Role.HEAD_TEACHER, Role.DEPUTY] },
 complaints: { view: [Role.DIRECTOR, Role.HEAD_TEACHER, Role.PARENT], create: [Role.PARENT], update: [Role.DIRECTOR, Role.HEAD_TEACHER] },
 examSessions: { view: [Role.DIRECTOR, Role.HEAD_TEACHER, Role.DEPUTY, Role.TEACHER], create: [Role.DEPUTY, Role.HEAD_TEACHER, Role.DIRECTOR], update: [Role.DEPUTY, Role.HEAD_TEACHER, Role.DIRECTOR], approve: [Role.HEAD_TEACHER, Role.DIRECTOR] },
 rubrics: { view: [Role.DIRECTOR, Role.HEAD_TEACHER, Role.DEPUTY, Role.TEACHER], create: [Role.DEPUTY, Role.HEAD_TEACHER, Role.DIRECTOR], update: [Role.DEPUTY, Role.HEAD_TEACHER, Role.DIRECTOR] },
 feeWaivers: { view: [Role.DIRECTOR, Role.HEAD_TEACHER, Role.ACCOUNTANT], create: [Role.ACCOUNTANT], approve: [Role.DIRECTOR] },
 textbooks: { view: [Role.DIRECTOR, Role.HEAD_TEACHER, Role.DEPUTY, Role.TEACHER], create: [Role.DEPUTY, Role.HEAD_TEACHER], update: [Role.DEPUTY, Role.HEAD_TEACHER], confirm: [Role.TEACHER] },
 schemesOfWork: { view: [Role.DIRECTOR, Role.HEAD_TEACHER, Role.DEPUTY, Role.TEACHER], create: [Role.TEACHER], update: [Role.TEACHER], confirm: [Role.DEPUTY], verify: [Role.HEAD_TEACHER] },
 timetable: { view: [Role.DIRECTOR, Role.HEAD_TEACHER, Role.DEPUTY, Role.TEACHER], create: [Role.DEPUTY, Role.HEAD_TEACHER], update: [Role.DEPUTY, Role.HEAD_TEACHER], verify: [Role.HEAD_TEACHER] },
 welfare: { view: [Role.DIRECTOR, Role.HEAD_TEACHER, Role.TEACHER, Role.WELFARE_CHAIR, Role.NON_TEACHING_STAFF, Role.SECRETARY, Role.ACCOUNTANT, Role.DEPUTY], create: [Role.WELFARE_CHAIR, Role.DIRECTOR], update: [Role.WELFARE_CHAIR, Role.DIRECTOR], approve: [Role.HEAD_TEACHER, Role.DIRECTOR], apply: ALL_STAFF },
 notifications: { view: ALL, update: ALL },
};
const scopes: Record<Resource, Partial<Record<DataScope, Role[]>>> = {
 dashboard: { school: [Role.DIRECTOR], academic: [Role.HEAD_TEACHER], operations: [Role.DEPUTY], finance: [Role.HEAD_TEACHER, Role.SECRETARY, Role.ACCOUNTANT], assigned: [Role.TEACHER, Role.WELFARE_CHAIR, Role.NON_TEACHING_STAFF], linked: [Role.PARENT], self: [Role.LEARNER] },
 accounts: { school: [Role.DIRECTOR] },
 staff: { school: [Role.DIRECTOR, Role.HEAD_TEACHER], self: ALL_STAFF },
 staffAttendance: { school: [Role.DIRECTOR, Role.HEAD_TEACHER, Role.DEPUTY], self: ALL_STAFF },
 learnerAccounts: { school: [Role.DIRECTOR, Role.SECRETARY] },
 learners: { school: [Role.DIRECTOR, Role.HEAD_TEACHER, Role.DEPUTY, Role.SECRETARY], assigned: [Role.TEACHER], linked: [Role.PARENT], self: [Role.LEARNER], "learner-identity": [Role.ACCOUNTANT] },
 admissions: { school: [Role.DIRECTOR, Role.HEAD_TEACHER, Role.DEPUTY, Role.SECRETARY] },
 attendance: { school: [Role.DIRECTOR, Role.HEAD_TEACHER, Role.DEPUTY], assigned: [Role.TEACHER], linked: [Role.PARENT], self: [Role.LEARNER] },
 assessments: { school: [Role.DIRECTOR, Role.HEAD_TEACHER, Role.DEPUTY], assigned: [Role.TEACHER], linked: [Role.PARENT], self: [Role.LEARNER] },
 discipline: { school: [Role.DIRECTOR, Role.HEAD_TEACHER, Role.DEPUTY], assigned: [Role.TEACHER], linked: [Role.PARENT] },
 finance: { school: [Role.DIRECTOR, Role.HEAD_TEACHER, Role.SECRETARY, Role.ACCOUNTANT], linked: [Role.PARENT] },
 invoices: { school: [Role.DIRECTOR, Role.HEAD_TEACHER, Role.SECRETARY, Role.ACCOUNTANT], linked: [Role.PARENT] },
 payments: { school: [Role.DIRECTOR, Role.HEAD_TEACHER, Role.ACCOUNTANT], linked: [Role.PARENT] },
 payroll: { school: [Role.DIRECTOR, Role.HEAD_TEACHER] },
 feeStructures: { school: [Role.DIRECTOR, Role.HEAD_TEACHER, Role.SECRETARY, Role.ACCOUNTANT] },
 audit: { school: [Role.DIRECTOR, Role.HEAD_TEACHER] },
 operations: { school: [Role.DIRECTOR, Role.HEAD_TEACHER, Role.DEPUTY], assigned: [Role.TEACHER] },
 guardians: { school: [Role.DIRECTOR] },
 exports: { school: [Role.DIRECTOR] },
 teachingLogs: { school: [Role.DIRECTOR, Role.HEAD_TEACHER], assigned: [Role.TEACHER] },
 assignments: { assigned: [Role.TEACHER], self: [Role.LEARNER] },
 learning: { assigned: [Role.TEACHER], self: [Role.LEARNER] },
 learningVideos: { school: [Role.DIRECTOR, Role.HEAD_TEACHER, Role.DEPUTY], assigned: [Role.TEACHER], self: [Role.LEARNER] },
 complaints: { school: [Role.DIRECTOR, Role.HEAD_TEACHER], self: [Role.PARENT] },
 examSessions: { school: [Role.DIRECTOR, Role.HEAD_TEACHER, Role.DEPUTY], assigned: [Role.TEACHER] },
 rubrics: { school: [Role.DIRECTOR, Role.HEAD_TEACHER, Role.DEPUTY, Role.TEACHER] },
 feeWaivers: { school: [Role.DIRECTOR, Role.HEAD_TEACHER, Role.ACCOUNTANT] },
 textbooks: { school: [Role.DIRECTOR, Role.HEAD_TEACHER, Role.DEPUTY], self: [Role.TEACHER] },
 schemesOfWork: { school: [Role.DIRECTOR, Role.HEAD_TEACHER, Role.DEPUTY], self: [Role.TEACHER] },
 timetable: { school: [Role.DIRECTOR, Role.HEAD_TEACHER, Role.DEPUTY, Role.TEACHER] },
 welfare: { school: [Role.DIRECTOR, Role.HEAD_TEACHER, Role.WELFARE_CHAIR], self: ALL_STAFF },
 notifications: { self: ALL },
};
export function can(role: Role, resource: Resource, action: Action): boolean { return matrix[resource][action]?.includes(role) ?? false; }
export function canInScope(role: Role, resource: Resource, action: Action, scope: DataScope): boolean { return can(role, resource, action) && (scopes[resource][scope]?.includes(role) ?? false); }
export function assertCan(role: Role, resource: Resource, action: Action): void { if (!can(role, resource, action)) throw new Error("FORBIDDEN"); }
export function assertCanInScope(role: Role, resource: Resource, action: Action, scope: DataScope): void { if (!canInScope(role, resource, action, scope)) throw new Error("FORBIDDEN"); }

export function canManageStaffTarget(actorRole: Role, targetRole: Role): boolean {
  if (actorRole === Role.DIRECTOR) return true;
  if (actorRole === Role.HEAD_TEACHER) {
    return targetRole !== Role.DIRECTOR && targetRole !== Role.HEAD_TEACHER;
  }
  return false;
}

export function canDeleteStaffAccount(actorRole: Role): boolean {
  return actorRole === Role.DIRECTOR;
}

export function canSuspendStaffAccount(actorRole: Role): boolean {
  return actorRole === Role.DIRECTOR;
}

export function canViewStaffStatutory(actorRole: Role): boolean {
  return actorRole === Role.DIRECTOR || actorRole === Role.HEAD_TEACHER || actorRole === Role.ACCOUNTANT;
}

export function canEditStaffStatutory(actorRole: Role, targetRole: Role): boolean {
  if (actorRole === Role.DIRECTOR) return true;
  if (actorRole === Role.HEAD_TEACHER) {
    return targetRole !== Role.DIRECTOR && targetRole !== Role.HEAD_TEACHER;
  }
  return false;
}

