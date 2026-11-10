import { NextResponse } from "next/server";
import {
  auditDenied,
  HttpError,
  requireSchoolActor,
} from "@/lib/auth";
import { canInScope } from "@/lib/permissions";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  buildPaymentConfigWrite,
  getPaymentSettingsView,
  paymentAuditMetadata,
  paymentSettingsPatchSchema,
  toPaymentSettingsView,
} from "@/lib/payment-settings";
import { withTenantContext } from "@/lib/tenant-db";
import { invalidateTenantCache } from "@/lib/tenant";

function noStore(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "cache-control": "no-store", pragma: "no-cache" },
  });
}

function errorResponse(error: unknown) {
  if (error instanceof HttpError) {
    return noStore({ error: error.message }, error.status);
  }
  if (
    error instanceof Error &&
    (error.message.includes("PAYMENT_ENCRYPTION_KEY") ||
      error.message.includes("Cannot encrypt an empty secret"))
  ) {
    return noStore(
      {
        error:
          "Payment credential encryption is not configured correctly on this server. Ask the platform administrator to set PAYMENT_ENCRYPTION_KEY.",
      },
      503,
    );
  }
  console.error(
    "[payment-settings] request failed",
    error instanceof Error ? error.message : "unknown",
  );
  return noStore({ error: "Payment settings could not be saved." }, 500);
}

export async function GET() {
  try {
    const actor = await requireSchoolActor();
    if (!canInScope(actor.role, "paymentSettings", "view", "school")) {
      await auditDenied(actor.id, actor.schoolId, "SchoolPaymentConfig");
      throw new HttpError(403, "Forbidden");
    }

    return noStore({ settings: await getPaymentSettingsView(actor.schoolId) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const actor = await requireSchoolActor();
    if (!canInScope(actor.role, "paymentSettings", "update", "school")) {
      await auditDenied(actor.id, actor.schoolId, "SchoolPaymentConfig");
      throw new HttpError(403, "Forbidden");
    }

    const limit = checkRateLimit(`payment-settings:${actor.id}`, 30, 60_000);
    if (!limit.allowed) {
      return noStore(
        { error: "Too many payment-settings changes. Wait a moment and try again." },
        429,
      );
    }

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

    // Encryption happens before the transaction. A missing/invalid key fails
    // closed and writes nothing at all.
    const { data, fields } = buildPaymentConfigWrite(parsed.data);

    const config = await withTenantContext(actor.schoolId, async (tx) => {
      const updated = await tx.schoolPaymentConfig.upsert({
        where: { schoolId: actor.schoolId },
        create: { schoolId: actor.schoolId, ...data },
        update: data,
      });

      await tx.auditEvent.create({
        data: {
          schoolId: actor.schoolId,
          actorId: actor.id,
          action: "PAYMENT_SETTINGS_UPDATED",
          entity: "SchoolPaymentConfig",
          entityId: updated.id,
          metadata: paymentAuditMetadata(fields),
        },
      });

      return updated;
    });

    invalidateTenantCache(actor.schoolId);

    return noStore({ settings: toPaymentSettingsView(actor.schoolId, config) });
  } catch (error) {
    return errorResponse(error);
  }
}
