import { z } from "zod";

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date.").refine(value => !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`)), "Enter a valid date.");
const kenyaPhone = z.string().regex(/^\+254[17]\d{8}$/, "Use a Kenyan number such as +254712345678.");
const optionalEmail = z.union([z.string().trim().email("Enter a valid email.").max(160), z.literal("")]).optional();
const text = (max = 160) => z.string().trim().max(max);
const grade = z.enum(["PP1","PP2","Grade 1","Grade 2","Grade 3","Grade 4","Grade 5","Grade 6","Grade 7","Grade 8","Grade 9"]);

export const guardianSchema = z.object({
  fullName: z.string().trim().min(2).max(120), relationship: z.string().trim().min(2).max(60), idNumber: text(40).optional(),
  phone: kenyaPhone, alternatePhone: z.union([kenyaPhone, z.literal("")]).optional(), whatsapp: z.boolean().default(false), email: optionalEmail,
  occupation: text(120).optional(), employer: text(120).optional(), homeAddress: text(240).optional(), workAddress: text(240).optional(),
  paysFees: z.boolean().default(false), primaryContact: z.boolean().default(false)
});
export const emergencyContactSchema = z.object({ fullName: z.string().trim().min(2).max(120), relationship: z.string().trim().min(2).max(60), phone: kenyaPhone });
export const pickupPersonSchema = z.object({ fullName: z.string().trim().min(2).max(120), relationship: z.string().trim().min(2).max(60), phone: kenyaPhone });

export const learnerAdmissionSchema = z.object({
  fullName: z.string().trim().min(2).max(120), dateOfBirth: dateOnly, gender: z.enum(["Female", "Male"]), nationality: z.string().trim().min(2).max(80),
  upiNumber: text(80).optional(), grade,
  stream: text(80).optional(), admissionDate: dateOnly, previousSchool: text(160).optional(), previousClass: text(80).optional(), reasonForLeaving: text(300).optional(),
  religion: text(80).optional(), languagesSpoken: z.array(z.string().trim().min(2).max(40)).min(1).max(8)
});
export const provisionalLearnerSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  dateOfBirth: dateOnly,
  gender: z.enum(["Female", "Male"]),
  grade,
  nationality: z.string().trim().min(2).max(80).default("Kenyan"),
  admissionDate: dateOnly.default(() => new Date().toISOString().slice(0, 10)),
  upiNumber: text(80).optional(),
  stream: text(80).optional(),
}).strict();
export const residenceSchema = z.object({ county: z.string().trim().min(2).max(80), subCounty: z.string().trim().min(2).max(80), ward: z.string().trim().min(2).max(100), village: z.string().trim().min(2).max(120), physicalAddress: z.string().trim().min(4).max(240), landmark: text(160).optional(), distanceToSchoolKm: z.union([z.number().min(0).max(100), z.null()]).optional(), transportMeans: text(100).optional(), latitude: z.union([z.number().min(-4.8).max(5.2), z.null()]).optional(), longitude: z.union([z.number().min(33.5).max(42.5), z.null()]).optional() });
export const healthSchema = z.object({ knownConditions: text(800).optional(), allergies: text(500).optional(), currentMedication: text(500).optional(), specialNeeds: text(500).optional(), bloodGroup: z.enum(["", "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]).optional(), doctorOrHospital: text(160).optional(), immunizationStatus: text(160).optional(), healthInsurance: text(120).optional() });
export const feeHandoffSchema = z.object({ term: z.string().trim().min(3).max(80), feePayerGuardian: z.string().trim().min(2).max(120), requestedOptionalItems: z.array(z.enum(["TRANSPORT", "LUNCH", "BOARDING", "UNIFORM", "ACTIVITY"])).max(5), handoffNote: text(300).optional() });

const draftText = (max = 500) => z.string().max(max);
const guardianDraftSchema = z.object({ fullName: draftText(120), relationship: draftText(60), idNumber: draftText(40), phone: draftText(24), alternatePhone: draftText(24), whatsapp: z.boolean(), email: draftText(160), occupation: draftText(120), employer: draftText(120), homeAddress: draftText(240), workAddress: draftText(240), paysFees: z.boolean(), primaryContact: z.boolean() }).partial();
const contactDraftSchema = z.object({ fullName: draftText(120), relationship: draftText(60), phone: draftText(24) }).partial();
export const admissionDraftDataSchema = z.object({
  learner: z.object({ fullName: draftText(120), dateOfBirth: draftText(10), gender: draftText(16), nationality: draftText(80), upiNumber: draftText(80), grade: draftText(40), stream: draftText(80), admissionDate: draftText(10), previousSchool: draftText(160), previousClass: draftText(80), reasonForLeaving: draftText(300), religion: draftText(80), languagesSpoken: z.array(draftText(40)).max(8) }).partial().optional(),
  residence: z.object({ county: draftText(80), subCounty: draftText(80), ward: draftText(100), village: draftText(120), physicalAddress: draftText(240), landmark: draftText(160), distanceToSchoolKm: z.union([z.number(), z.null()]), transportMeans: draftText(100), latitude: z.union([z.number(), z.null()]), longitude: z.union([z.number(), z.null()]) }).partial().optional(),
  guardians: z.array(guardianDraftSchema).max(5).optional(), emergencyContacts: z.array(contactDraftSchema).max(5).optional(), pickupPersons: z.array(contactDraftSchema).max(10).optional(),
  health: z.object({ knownConditions: draftText(800), allergies: draftText(500), currentMedication: draftText(500), specialNeeds: draftText(500), bloodGroup: draftText(8), doctorOrHospital: draftText(160), immunizationStatus: draftText(160), healthInsurance: draftText(120) }).partial().optional(),
  fee: z.object({ term: draftText(80), feePayerGuardian: draftText(120), requestedOptionalItems: z.array(z.enum(["TRANSPORT", "LUNCH", "BOARDING", "UNIFORM", "ACTIVITY"])).max(5), handoffNote: draftText(300) }).partial().optional(),
  consent: z.boolean().optional()
}).strict();

export const completedAdmissionSchema = z.object({
  learner: learnerAdmissionSchema, residence: residenceSchema, guardians: z.array(guardianSchema).min(1).max(5),
  emergencyContacts: z.array(emergencyContactSchema).min(2).max(5), pickupPersons: z.array(pickupPersonSchema).max(10),
  health: healthSchema, fee: feeHandoffSchema, consent: z.literal(true)
}).refine(value => value.guardians.filter(person => person.primaryContact).length === 1, { message: "Choose exactly one primary parent or guardian contact.", path: ["guardians"] })
  .refine(value => value.guardians.some(person => person.paysFees) || Boolean(value.fee.feePayerGuardian), { message: "Identify the person responsible for fees.", path: ["fee", "feePayerGuardian"] });

export const admissionDraftCreateSchema = z.object({}).strict();
export const admissionDraftPatchSchema = z.object({ id: z.string().cuid(), step: z.number().int().min(1).max(7), data: admissionDraftDataSchema }).strict();
export const admissionDocumentCategory = z.enum(["PASSPORT_PHOTO", "BIRTH_CERTIFICATE", "PREVIOUS_REPORT", "IMMUNIZATION_CARD", "PARENT_ID", "OTHER"]);
export const guardianLoginSchema = z.object({ guardianIndex: z.number().int().min(0).max(4) }).strict();
export const admissionDocumentCategoryLabels: Record<z.infer<typeof admissionDocumentCategory>, string> = { PASSPORT_PHOTO: "Learner passport photo", BIRTH_CERTIFICATE: "Birth certificate", PREVIOUS_REPORT: "Previous school report or leaving certificate", IMMUNIZATION_CARD: "Immunization card", PARENT_ID: "Parent or guardian ID copy", OTHER: "Additional document" };
export type AdmissionDraftData = z.infer<typeof admissionDraftDataSchema>;
export type CompletedAdmission = z.infer<typeof completedAdmissionSchema>;

export function mergeAdmissionData(current: AdmissionDraftData, patch: AdmissionDraftData): AdmissionDraftData {
  const merged: Record<string, unknown> = { ...current };
  for (const [key, value] of Object.entries(patch)) {
    if (value && typeof value === "object" && !Array.isArray(value)) merged[key] = { ...((current as Record<string, unknown>)[key] as object ?? {}), ...value };
    else merged[key] = value;
  }
  return admissionDraftDataSchema.parse(merged);
}
