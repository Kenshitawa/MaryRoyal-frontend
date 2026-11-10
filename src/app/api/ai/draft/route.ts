import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { db } from "@/lib/db";
import { readSession } from "@/lib/session";
import { canInScope } from "@/lib/permissions";

const inputSchema = z.object({
  kind: z.enum(["scheme", "weekly", "textbook"]),
  grade: z.string().trim().min(1).max(20),
  subject: z.string().trim().min(1).max(60),
  topic: z.string().trim().min(2).max(250),
}).strict();

const schemeSchema = z.object({ strand: z.string().min(2).max(120), subStrand: z.string().min(2).max(120), learningOutcomes: z.string().min(10).max(1000), keyInquiryQuestions: z.string().min(5).max(500), learningExperiences: z.string().min(10).max(1200), learningResources: z.string().min(5).max(500), assessmentMethods: z.string().min(5).max(500) });
const weeklySchema = z.object({ topics: z.string().min(10).max(1200), reflection: z.string().max(600) });
const textbookSchema = z.object({ title: z.string().min(3).max(120), publisher: z.string().max(80), curriculumCode: z.string().max(40) });

export async function POST(request: Request) {
  const token = (await cookies()).get("school_session")?.value;
  const session = token ? await readSession(token) : null;
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const actor = await db.user.findUnique({ where: { id: session.id }, select: { id: true, role: true, suspended: true, forcePasswordChange: true } });
  if (!actor || actor.suspended || actor.forcePasswordChange) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const parsed = inputSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Choose a class, learning area and topic." }, { status: 400 });

  const { kind, grade, subject, topic } = parsed.data;
  if (kind === "scheme" || kind === "weekly") {
    const resource = kind === "scheme" ? "schemesOfWork" : "teachingLogs";
    const action = kind === "scheme" ? "create" : "create";
    if (!canInScope(actor.role, resource, action, "assigned")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const assignment = await db.teacherAssignment.findUnique({ where: { teacherId_grade_subject: { teacherId: actor.id, grade, subject } }, select: { id: true } });
    if (!assignment) return NextResponse.json({ error: "This grade and learning area are outside your teaching assignment." }, { status: 403 });
  } else if (!canInScope(actor.role, "textbooks", "create", "school")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const schemas = { scheme: schemeSchema, weekly: weeklySchema, textbook: textbookSchema };
  const schema = schemas[kind];
  const prompt = kind === "scheme"
    ? `Draft a practical Kenya CBC scheme of work section for ${grade}, ${subject}, topic ${topic}. Return JSON with strand, subStrand, learningOutcomes, keyInquiryQuestions, learningExperiences, learningResources, assessmentMethods. Be age appropriate and concise.`
    : kind === "weekly"
      ? `Draft a brief teacher's weekly taught-content summary for ${grade}, ${subject}, topic ${topic}. Return JSON with topics and reflection. Keep it factual and concise; do not claim teaching happened, label it as a draft for the teacher to verify.`
      : `Suggest a school textbook catalogue record for ${grade}, ${subject}, topic ${topic}. Do not invent a real publisher or ISBN. Return JSON with title, publisher (empty if unknown), curriculumCode (empty if unknown).`;
  try {
    const response = await fetch("http://127.0.0.1:11434/api/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: process.env.OLLAMA_MODEL || "llama3.2", stream: false, format: "json", prompt }), signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error("Local model unavailable");
    const payload = await response.json() as { response?: string };
    const draft = schema.safeParse(JSON.parse(payload.response ?? ""));
    if (!draft.success) throw new Error("Local model response was invalid");
    return NextResponse.json({ draft: draft.data, provider: "local" });
  } catch {
    return NextResponse.json({ error: "Local AI is unavailable. Configure Ollama locally and try again. No school data was sent externally or changed." }, { status: 503 });
  }
}
