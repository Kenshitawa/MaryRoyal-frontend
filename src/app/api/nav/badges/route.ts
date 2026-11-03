import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { readSession } from "@/lib/session";

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

export async function GET() {
  const user = await actor();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  let unreadNotifications = 0;
  let pendingComplaints = 0;
  let pendingApprovals = 0;
  let welfareBadge = 0;

  try {
    const [unread, unreadWelfare] = await Promise.all([
      db.notification.count({
        where: { userId: user.id, read: false },
      }),
      db.notification.count({
        where: {
          userId: user.id,
          read: false,
          OR: [
            { link: { contains: "/welfare" } },
            { title: { contains: "Welfare" } },
          ],
        },
      }),
    ]);
    unreadNotifications = unread;
    welfareBadge = unreadWelfare;

    if (user.role === "DIRECTOR" || user.role === "HEAD_TEACHER") {
      const [complaintsCount, waiversCount, timetablesCount, pendingLoansCount] = await Promise.all([
        db.complaint.count({ where: { status: "OPEN" } }),
        db.feeWaiver.count({ where: { status: "PENDING" } }),
        db.schoolTimetable.count({ where: { status: "PENDING_APPROVAL" } }),
        db.welfareLoan.count({
          where: {
            status: user.role === "HEAD_TEACHER" ? "PENDING_HEADTEACHER" : "PENDING_DIRECTOR",
          },
        }),
      ]);
      pendingComplaints = complaintsCount;
      pendingApprovals = waiversCount + timetablesCount;
      welfareBadge = Math.max(unreadWelfare, pendingLoansCount);
    } else if (user.role === "WELFARE_CHAIR") {
      const chairLoansCount = await db.welfareLoan.count({
        where: { status: "APPROVED" }, // awaiting disbursement
      });
      welfareBadge = Math.max(unreadWelfare, chairLoansCount);
    } else if (user.role === "PARENT") {
      const parentComplaints = await db.complaint.count({
        where: {
          openedById: user.id,
          replies: {
            some: {
              authorId: { not: user.id },
            },
          },
        },
      });
      pendingComplaints = parentComplaints;
    }
  } catch (err) {
    console.error("Failed to load nav badges:", err);
  }

  return NextResponse.json({
    unreadNotifications,
    pendingComplaints,
    pendingApprovals,
    welfare: welfareBadge,
    welfareBadge,
    messages: pendingComplaints + (user.role === "PARENT" ? unreadNotifications : 0),
  });
}
