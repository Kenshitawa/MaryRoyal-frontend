import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { readSession } from "@/lib/session";
import { canInScope } from "@/lib/permissions";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const token = (await cookies()).get("mary_session")?.value;
  const session = token ? await readSession(token) : null;
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const user = await db.user.findUnique({ where: { id: session.id }, select: { id: true, role: true, suspended: true, forcePasswordChange: true } });
  if (!user || user.suspended || user.forcePasswordChange) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (!canInScope(user.role, "complaints", "update", "school")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const complaint = await db.complaint.findUnique({
    where: { id },
    include: {
      replies: {
        orderBy: { createdAt: "asc" },
        include: { author: { select: { name: true, role: true } } },
      },
    },
  });

  if (!complaint) return NextResponse.json({ error: "Complaint not found" }, { status: 404 });

  const allText = [
    complaint.subject,
    ...complaint.replies.map((r) => `${r.author.role}: ${r.message}`),
  ].join("\n");

  let suggestedStatus: "RECEIVED" | "IN_REVIEW" | "RESOLVED" = "RECEIVED";
  let reasoning = "Fresh inquiry without leadership engagement.";

  // Attempt local Ollama model if available
  try {
    const prompt = `You are a school administration complaint triage assistant for Mary Royal School.
Evaluate this school inquiry thread and decide if the status should be RECEIVED, IN_REVIEW, or RESOLVED.
Rules:
- If leadership answered the problem, fixed the record, or both parties concluded the issue: RESOLVED
- If leadership is still investigating, checking details, or asking follow-up questions: IN_REVIEW
- If newly received with 0 or 1 reply without action: RECEIVED

Thread:
${allText}

Return valid JSON with "status" (one of RECEIVED, IN_REVIEW, RESOLVED) and "reasoning" (one sentence).`;

    const response = await fetch("http://127.0.0.1:11434/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OLLAMA_MODEL || "llama3.2",
        stream: false,
        format: "json",
        prompt,
      }),
      signal: AbortSignal.timeout(5000),
    });

    if (response.ok) {
      const payload = (await response.json()) as { response?: string };
      const parsed = JSON.parse(payload.response ?? "{}") as { status?: string; reasoning?: string };
      if (parsed.status && ["RECEIVED", "IN_REVIEW", "RESOLVED"].includes(parsed.status)) {
        return NextResponse.json({
          suggestedStatus: parsed.status,
          reasoning: parsed.reasoning || "Evaluated by local school AI model.",
          provider: "local-model",
        });
      }
    }
  } catch {
    // Fall through to deterministic rule-based NLP triage
  }

  // Deterministic local CBC NLP rule-based triage fallback
  const lower = allText.toLowerCase();
  const resolvedWords = [
    "resolved", "rectified", "sorted", "cleared", "thank you", "updated", "corrected",
    "issued receipt", "payment recorded", "problem fixed", "completed", "done", "closed",
    "apologies for the delay, this is now settled"
  ];
  const inReviewWords = [
    "looking into", "checking", "investigating", "reviewing", "we will follow up",
    "please bring", "please provide", "give us until", "noted with thanks, currently examining"
  ];

  const hasResolution = resolvedWords.some((w) => lower.includes(w));
  const hasReview = inReviewWords.some((w) => lower.includes(w));

  if (complaint.replies.length >= 2 && hasResolution) {
    suggestedStatus = "RESOLVED";
    reasoning = "Leadership response indicates the issue has been addressed and concluded.";
  } else if (complaint.replies.length >= 1 || hasReview) {
    suggestedStatus = "IN_REVIEW";
    reasoning = "Active correspondence in progress between family and administration.";
  } else {
    suggestedStatus = "RECEIVED";
    reasoning = "Inquiry logged and awaiting leadership review.";
  }

  return NextResponse.json({
    suggestedStatus,
    reasoning,
    provider: "local-rules",
  });
}

