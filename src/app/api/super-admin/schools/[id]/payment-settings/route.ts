import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getPlatformActor, PlatformAuthError } from "@/lib/platform-auth";
import {
  buildPaymentConfigWrite,
  paymentAuditMetadata,
  paymentSettingsPatchSchema,
  toPaymentSettingsView,
} from "@/lib/payment-settings";
import { checkRateLimit } from "@/lib/rate-limit";
import { withSuperAdminContext } from "@/lib/tenant-db";
import { invalidateTenantCache } from "@/lib/tenant";

function noStore(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "cache-control": "no-store", pragma: "no-cache" },
  });
}

function platformError(error: unknown) {
  if (error instanceof PlatformAuthError) {
    return noStore({ error: error.message }, error.status);
  }
  return null;
}

async function schoolOrNull(id: string) {
  return db.school.findUnique({
    where: { id },
    select: { id: true, slug: true, name: true },
  });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = await getPlatformActor();
  if (!actor) return noStore({ error: "Unauthorized platform access." }, 401);

  const { id } = await params;
  const school = await schoolOrNull(id);
  if (!school) return noStore({ error: "School not found." }, 404);

  const config = await db.schoolPaymentConfig.findUnique({ where: { schoolId: school.id } });
  return noStore({
    school: { id: school.id, slug: school.slug, name: school.name },
    settings: toPaymentSettingsView(school.id, config),
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = await getPlatformActor();
  if (!actor) return noStore({ error: "Unauthorized platform access." }, 401);

  const limit = checkRateLimit(`platform-payment-settings:${actor.id}`, 60, 60_000);
  if (!limit.allowed) {
    return noStore(
      { error: "Too many payment-settings changes. Wait a moment and try again." },
      429,
    );
  }

  const { id } = await params;
  const school = await schoolOrNull(id);
  if (!school) return noStore({ error: "School not found." }, 404);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return noStore({ error: "Send payment settings as JSON." }, 400);
  }

  const parsed = paymentSettingsPatchSchema.safeParse(body);
  if (!parsed.success) {
    return noStore(
      {
        error: parsed.error.issues[0]?.message ?? "Check the payment settings.",
        field: parsed.error.issues[0]?.path.join(".") ?? null,
      },
      400,
    );
  }

  try {
    const { data, fields } = buildPaymentConfigWrite(parsed.data);

    const config = await withSuperAdminContext(async (tx) => {
      const updated = await tx.schoolPaymentConfig.upsert({
        where: { schoolId: school.id },
        create: { schoolId: school.id, ...data },
        update: data,
      });

      await tx.platformAuditEvent.create({
        data: {
          actorId: actor.id,
          actorEmail: actor.email,
          action: "PAYMENT_SETTINGS_UPDATED",
          entity: "School",
          entityId: school.id,
          metadata: paymentAuditMetadata(fields),
        },
      });

      // The school's own audit trail should show platform-initiated changes.
      await tx.auditEvent.create({
        data: {
          schoolId: school.id,
          action: "PAYMENT_SETTINGS_UPDATED",
          entity: "SchoolPaymentConfig",
          entityId: updated.id,
          metadata: JSON.stringify({ fields, source: "platform" }),
        },
      });

      return updated;
    });

    invalidateTenantCache(school.id);
    invalidateTenantCache(school.slug);

    return noStore({
      school: { id: school.id, slug: school.slug, name: school.name },
      settings: toPaymentSettingsView(school.id, config),
    });
  } catch (error) {
    const platform = platformError(error);
    if (platform) return platform;
    if (
      error instanceof Error &&
      (error.message.includes("PAYMENT_ENCRYPTION_KEY") ||
        error.message.includes("Cannot encrypt an empty secret"))
    ) {
      return noStore(
        {
          error:
            "Payment credential encryption is not configured correctly on this server. Set PAYMENT_ENCRYPTION_KEY before saving Daraja secrets.",
        },
        503,
      );
    }
    console.error(
      "[super-admin] payment settings update failed",
      error instanceof Error ? error.message : "unknown",
    );
    return noStore({ error: "Payment settings could not be saved." }, 500);
  }
}
