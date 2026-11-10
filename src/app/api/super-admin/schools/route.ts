import { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getPlatformActor, PlatformAuthError } from "@/lib/platform-auth";
import {
  provisionSchool,
  provisionSchoolSchema,
  ProvisioningError,
} from "@/lib/provisioning";
import { checkRateLimit, clientIpFromRequest } from "@/lib/rate-limit";

const idempotencySchema = z.string().regex(/^[A-Za-z0-9_-]{16,128}$/);

function noStore(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "cache-control": "no-store", pragma: "no-cache" },
  });
}

function platformError(error: unknown) {
  if (error instanceof PlatformAuthError) return noStore({ error: error.message }, error.status);
  return null;
}

function formString(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value : "";
}

export async function GET(request: Request) {
  const actor = await getPlatformActor();
  if (!actor) return noStore({ error: "Unauthorized platform access." }, 401);

  const searchParams = new URL(request.url).searchParams;
  const page = Math.max(1, Number.parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(
    50,
    Math.max(1, Number.parseInt(searchParams.get("pageSize") ?? "20", 10) || 20),
  );
  const q = (searchParams.get("q") ?? "").trim().slice(0, 100);

  const where = q
    ? {
        OR: [
          { name: { contains: q } },
          { slug: { contains: q } },
          { contactEmail: { contains: q } },
        ],
      }
    : {};

  try {
    const [total, schools] = await Promise.all([
      db.school.count({ where }),
      db.school.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          name: true,
          slug: true,
          logoUrl: true,
          status: true,
          createdAt: true,
          users: {
            where: { role: Role.DIRECTOR },
            take: 1,
            select: { name: true, email: true },
          },
          _count: { select: { learners: true, users: true } },
        },
      }),
    ]);

    return noStore({
      schools: schools.map((school) => ({
        id: school.id,
        name: school.name,
        slug: school.slug,
        logoUrl: school.logoUrl,
        status: school.status,
        createdAt: school.createdAt,
        director: school.users[0] ?? null,
        counts: school._count,
      })),
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    });
  } catch (error) {
    console.error("[super-admin] school list failed", error instanceof Error ? error.message : "unknown");
    return noStore({ error: "Could not load schools." }, 500);
  }
}

export async function POST(request: Request) {
  const actor = await getPlatformActor();
  if (!actor) return noStore({ error: "Unauthorized platform access." }, 401);

  const idempotencyKey = idempotencySchema.safeParse(
    request.headers.get("idempotency-key")?.trim(),
  );
  if (!idempotencyKey.success) {
    return noStore({ error: "A valid Idempotency-Key header is required." }, 400);
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data")) {
    return noStore({ error: "Submit the form as multipart form data." }, 415);
  }

  const limit = checkRateLimit(`provision:${actor.id}`, 30, 60 * 60_000);
  if (!limit.allowed) {
    return noStore(
      { error: "Too many provisioning attempts. Wait before trying again." },
      429,
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return noStore({ error: "Could not read the submitted form." }, 400);
  }

  const logo = form.get("logo");
  if (!(logo instanceof File) || logo.size === 0) {
    return noStore({ error: "Choose a school logo to upload." }, 400);
  }

  const parsed = provisionSchoolSchema.safeParse({
    name: formString(form, "name"),
    slug: formString(form, "slug"),
    motto: formString(form, "motto"),
    slogan: formString(form, "slogan"),
    primaryColour: formString(form, "primaryColour"),
    secondaryColour: formString(form, "secondaryColour"),
    accentColour: formString(form, "accentColour"),
    contactEmail: formString(form, "contactEmail"),
    contactPhone: formString(form, "contactPhone"),
    poBox: formString(form, "poBox"),
    physicalAddress: formString(form, "physicalAddress"),
    directorName: formString(form, "directorName"),
    directorEmail: formString(form, "directorEmail"),
    directorPhone: formString(form, "directorPhone"),
    directorUsername: formString(form, "directorUsername"),
  });

  if (!parsed.success) {
    return noStore(
      {
        error: parsed.error.issues[0]?.message ?? "Check the school details and try again.",
        field: parsed.error.issues[0]?.path.join(".") ?? null,
      },
      400,
    );
  }

  try {
    const result = await provisionSchool(parsed.data, {
      idempotencyKey: idempotencyKey.data,
      logo,
      actor,
      ipAddress: clientIpFromRequest(request),
    });
    return noStore(result, result.created ? 201 : 200);
  } catch (error) {
    const platform = platformError(error);
    if (platform) return platform;
    if (error instanceof ProvisioningError) {
      return noStore({ error: error.message, code: error.code }, error.status);
    }
    console.error("[super-admin] provisioning failed", error instanceof Error ? error.message : "unknown");
    return noStore(
      { error: "The school could not be provisioned. Check the details and try again." },
      500,
    );
  }
}
