import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { readStoredFile } from "@/lib/file-storage";
import { schoolLogoKey } from "@/lib/school-logo";
import { isValidSlug } from "@/lib/tenant-host";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug: rawSlug } = await context.params;
  const slug = rawSlug.toLowerCase();
  if (!isValidSlug(slug)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const school = await db.school.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!school) return new NextResponse("Not found", { status: 404 });

  let bytes: Buffer;
  try {
    bytes = await readStoredFile("private", schoolLogoKey(slug));
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }

  const etag = `"${createHash("sha256").update(bytes).digest("base64url")}"`;
  if (request.headers.get("if-none-match") === etag) {
    return new NextResponse(null, {
      status: 304,
      headers: { etag, "cache-control": "public, max-age=3600, stale-while-revalidate=86400" },
    });
  }

  return new NextResponse(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "content-type": "image/webp",
      "content-length": String(bytes.length),
      etag,
      "cache-control": "public, max-age=3600, stale-while-revalidate=86400",
      "x-content-type-options": "nosniff",
    },
  });
}
