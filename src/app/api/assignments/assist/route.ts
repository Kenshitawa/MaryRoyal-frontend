import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { db } from "@/lib/db";
import { readSession } from "@/lib/session";
import { canInScope } from "@/lib/permissions";

const inputSchema = z.object({ grade: z.string().min(2).max(20), subject: z.string().min(2).max(60), topic: z.string().trim().min(3).max(200) });
const outputSchema = z.object({ title: z.string().min(3).max(120), instructions: z.string().min(5).max(2000), answerKey: z.string().max(500).optional() });
export async function POST(request: Request) {
  const token = (await cookies()).get("mary_session")?.value;
  const session = token ? await readSession(token) : null;
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const actor = await db.user.findUnique({ where: { id: session.id }, select: { id: true, role: true, suspended: true, forcePasswordChange: true } });
  if (!actor || actor.suspended || actor.forcePasswordChange) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const isLeader = actor.role === "DIRECTOR" || actor.role === "HEAD_TEACHER";
  const scope = isLeader ? "school" : "assigned";
  if (!canInScope(actor.role, "assignments", "create", scope)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const parsed = inputSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Choose a class, subject and learning topic." }, { status: 400 });

  if (!isLeader) {
    const assignmentsCount = await db.teacherAssignment.count({ where: { teacherId: actor.id } });
    if (assignmentsCount > 0) {
      const assigned = await db.teacherAssignment.findUnique({ where: { teacherId_grade_subject: { teacherId: actor.id, grade: parsed.data.grade, subject: parsed.data.subject } } });
      if (!assigned) return NextResponse.json({ error: "This class and subject are outside your teaching assignment." }, { status: 403 });
    }
  }

  const { grade, subject, topic } = parsed.data;

  try {
    const response = await fetch("http://127.0.0.1:11434/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OLLAMA_MODEL || "llama3.2",
        stream: false,
        format: "json",
        prompt: `Create one age-appropriate Kenyan CBC classroom assignment for ${grade} ${subject}, topic: ${topic}. Return only JSON with title, clear learner-facing instructions (3 questions), and a concise answerKey that can be checked case-insensitively. JSON shape: {"title":"...","instructions":"...","answerKey":"..."}. Do not include personal data.`
      }),
      signal: AbortSignal.timeout(6000)
    });
    if (response.ok) {
      const payload = await response.json() as { response?: string };
      const draft = outputSchema.safeParse(JSON.parse(payload.response ?? ""));
      if (draft.success) {
        return NextResponse.json({ draft: draft.data, provider: "local-ollama" });
      }
    }
  } catch {
    // Fall back to local rule-based CBE draft generator (100% on-campus, zero-data leak)
  }

  // Robust local rule-based CBC draft question generator
  const fallbackDraft = {
    title: `${topic} — ${subject} Task`,
    instructions: `Instructions for ${grade} Learners:\n\n1. Define or explain what is meant by "${topic}" in your own words.\n2. Give two practical real-life examples related to ${topic} observed in your school or home environment.\n3. Solve or demonstrate understanding: Write down 3 key principles or steps learned about ${topic}.\n\nWrite your responses clearly in complete sentences.`,
    answerKey: `Model Answers:\n1. Accurate definition demonstrating understanding of ${topic}.\n2. Two valid practical examples.\n3. Key principles accurately stated.`
  };

  return NextResponse.json({ draft: fallbackDraft, provider: "local-rules" });
}
