import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { db } from "@/lib/db";
import { canInScope } from "@/lib/permissions";
import { readSession } from "@/lib/session";
import { youtubeVideoId } from "@/lib/learning-videos";

const input = z.object({ url: z.string().url().max(500), grade: z.string().min(2).max(20), subject: z.string().min(2).max(60), strand: z.string().min(2).max(120), subStrand: z.string().max(120).optional() });
async function actor() {
  const token = (await cookies()).get("school_session")?.value;
  const session = token ? await readSession(token) : null;
  return session ? db.user.findUnique({ where: { id: session.id }, select: { id: true, role: true, suspended: true, forcePasswordChange: true } }) : null;
}

export async function GET() {
  const user = await actor();
  if (!user || user.suspended || user.forcePasswordChange) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (canInScope(user.role, "learningVideos", "view", "self")) {
    const link = await db.guardianLink.findFirst({ where: { userId: user.id, relation: "Learner", learner: { archivedAt: null, admissionStatus: "APPROVED" } }, select: { learnerId: true, learner: { select: { grade: true } } } });
    if (!link) return NextResponse.json({ videos: [], weakTopics: [] });
    const assessments = await db.assessment.findMany({ where: { learnerId: link.learnerId, status: "RELEASED" }, select: { subject: true, score: true, strand: true, term: true }, orderBy: { term: "desc" }, take: 100 });
    const weak = assessments.filter((row) => row.score < 60).map((row) => ({ subject: row.subject, strand: row.strand }));
    const subjects = [...new Set(weak.map((row) => row.subject))];
    const videos = subjects.length ? await db.learningVideo.findMany({ where: { grade: link.learner.grade, subject: { in: subjects }, status: "VERIFIED", OR: weak.flatMap((row) => row.strand ? [{ subject: row.subject, strand: row.strand }, { subject: row.subject, strand: "General revision" }] : [{ subject: row.subject }]) }, include: { watches: { where: { learnerId: link.learnerId }, select: { watchedAt: true } } }, orderBy: [{ subject: "asc" }, { strand: "asc" }] }) : [];
    return NextResponse.json({ videos: videos.map(({ watches, ...video }) => ({ ...video, watched: watches.length > 0, watchedAt: watches[0]?.watchedAt ?? null })), weakTopics: [...new Map(weak.map((row) => [`${row.subject}:${row.strand ?? ""}`, row])).values()] });
  }
  if (canInScope(user.role, "learningVideos", "view", "assigned")) {
    const assignments = await db.teacherAssignment.findMany({ where: { teacherId: user.id }, select: { grade: true, subject: true } });
    const gradeList = [...new Set(assignments.map((row) => row.grade))];
    const videos = assignments.length ? await db.learningVideo.findMany({
      where: { status: "VERIFIED", OR: assignments.map((row) => ({ grade: row.grade, subject: row.subject })) },
      include: { watches: { where: { learner: { grade: { in: gradeList } } }, include: { learner: { select: { id: true, name: true, admissionNo: true, grade: true } } } } },
      orderBy: { createdAt: "desc" },
    }) : [];
    return NextResponse.json({ videos: videos.map((video) => ({ ...video, watchCount: video.watches.length, watchedBy: video.watches.map((watch) => watch.learner) })) });
  }
  if (!canInScope(user.role, "learningVideos", "view", "school")) { await db.auditEvent.create({ data: { actorId: user.id, action: "ACCESS_DENIED", entity: "LearningVideo" } }); return NextResponse.json({ error: "Forbidden" }, { status: 403 }); }
  const videos = await db.learningVideo.findMany({ where: { status: "VERIFIED" }, include: { addedBy: { select: { name: true } }, _count: { select: { watches: true } } }, orderBy: { createdAt: "desc" }, take: 200 });
  return NextResponse.json({ videos });
}

export async function POST(request: Request) {
  const user = await actor();
  if (!user || user.suspended || user.forcePasswordChange) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (!canInScope(user.role, "learningVideos", "create", user.role === "TEACHER" ? "assigned" : "school")) { await db.auditEvent.create({ data: { actorId: user.id, action: "ACCESS_DENIED", entity: "LearningVideo" } }); return NextResponse.json({ error: "Forbidden" }, { status: 403 }); }
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const parsed = input.safeParse(body);
  const videoId = parsed.success ? youtubeVideoId(parsed.data.url) : null;
  if (!parsed.success || !videoId) return NextResponse.json({ error: "Use a valid YouTube video URL, class, subject and strand." }, { status: 400 });
  if (user.role === "TEACHER") {
    const assignment = await db.teacherAssignment.findUnique({ where: { teacherId_grade_subject: { teacherId: user.id, grade: parsed.data.grade, subject: parsed.data.subject } }, select: { id: true } });
    if (!assignment) return NextResponse.json({ error: "This class and subject are outside your teaching assignment." }, { status: 403 });
  }
  let verifiedTitle = "";
  try {
    const metadata = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}`, { signal: AbortSignal.timeout(8000), headers: { "user-agent": "MaryRoyalLearningLibrary/1.0" }, cache: "no-store" });
    if (!metadata.ok) return NextResponse.json({ error: "YouTube could not verify that video." }, { status: 422 });
    const details: unknown = await metadata.json();
    const verified = z.object({ title: z.string().min(2).max(200), author_url: z.string().url() }).safeParse(details);
    if (!verified.success) return NextResponse.json({ error: "Only videos from KICD's official Edu TV Kenya channel can be added." }, { status: 422 });
    const authorUrl = new URL(verified.data.author_url);
    if (!/^([a-z0-9-]+\.)?youtube\.com$/i.test(authorUrl.hostname) || authorUrl.pathname.toLowerCase().replace(/\/$/, "") !== "/@edutvkenya") return NextResponse.json({ error: "Only videos from KICD's official Edu TV Kenya channel can be added." }, { status: 422 });
    verifiedTitle = verified.data.title;
  } catch { return NextResponse.json({ error: "Official video verification is unavailable. Try again when internet access is available." }, { status: 503 }); }
  try {
    const result = await db.$transaction(async (tx) => {
      const video = await tx.learningVideo.create({ data: { title: verifiedTitle, videoId, grade: parsed.data.grade, subject: parsed.data.subject, strand: parsed.data.strand, subStrand: parsed.data.subStrand || null, addedById: user.id, source: "KICD_EDUTV", status: "VERIFIED" } });
      await tx.auditEvent.create({ data: { actorId: user.id, action: "LEARNING_VIDEO_ADDED", entity: "LearningVideo", entityId: video.id } });
      return video;
    });
    return NextResponse.json({ video: result }, { status: 201 });
  } catch { return NextResponse.json({ error: "That video is already in the school library." }, { status: 409 }); }
}
