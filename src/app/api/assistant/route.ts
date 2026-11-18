import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { db } from "@/lib/db";
import { readSession } from "@/lib/session";
import { checkRateLimit } from "@/lib/rate-limit";
import { answerQuestion } from "@/lib/assistant";

const inputSchema = z
  .object({
    question: z.string().trim().min(1, "Type a question.").max(500, "Keep the question under 500 characters."),
  })
  .strict();

export async function POST(request: Request) {
  const token = (await cookies()).get("mary_session")?.value;
  const session = token ? await readSession(token) : null;
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const actor = await db.user.findUnique({
    where: { id: session.id },
    select: { id: true, name: true, role: true, suspended: true, forcePasswordChange: true },
  });
  if (!actor || actor.suspended || actor.forcePasswordChange) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const limit = checkRateLimit(`assistant:${actor.id}`, 30, 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: `Too many questions. Try again in ${limit.retryAfterSeconds}s.` },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const parsed = inputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid question." }, { status: 400 });
  }

  try {
    const answer = await answerQuestion({
      question: parsed.data.question,
      role: actor.role,
      userId: actor.id,
      name: actor.name,
    });
    return NextResponse.json(answer, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "The assistant could not read the school records. Try again." }, { status: 500 });
  }
}
