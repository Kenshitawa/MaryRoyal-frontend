import { z } from "zod";
import { db } from "./db";
import {
  decryptSecret,
  encryptSecret,
  isPaymentEncryptionConfigured,
  maskSecret,
} from "./crypto";

const ACCOUNT_FORMATS = ["ADMISSION_NO", "INVOICE_NO", "LEARNER_ID"] as const;
const DARAJA_ENVIRONMENTS = ["sandbox", "production"] as const;

function trimmedOrNull(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function optionalDigits(label: string) {
  return z.preprocess(
    trimmedOrNull,
    z
      .union([
        z.string().regex(/^\d{5,9}$/, `${label} must be 5 to 9 digits.`),
        z.null(),
      ])
      .optional(),
  );
}

function optionalText(label: string, max: number, min = 2) {
  return z.preprocess(
    trimmedOrNull,
    z
      .union([
        z.string().min(min, `${label} is too short.`).max(max, `${label} is too long.`),
        z.null(),
      ])
      .optional(),
  );
}

const optionalBankAccount = z.preprocess(
  trimmedOrNull,
  z
    .union([
      z
        .string()
        .min(4, "Bank account number is too short.")
        .max(34, "Bank account number is too long.")
        .regex(/^[0-9A-Za-z][0-9A-Za-z /-]*$/, "Use letters, digits, spaces, / or - only."),
      z.null(),
    ])
    .optional(),
);

const secretValue = z.union([
  z
    .string()
    .trim()
    .min(8, "Daraja credentials must be at least 8 characters.")
    .max(512, "Daraja credentials are too long."),
  z.null(),
]);

const darajaPatchSchema = z
  .object({
    consumerKey: secretValue.optional(),
    consumerSecret: secretValue.optional(),
    passkey: secretValue.optional(),
    shortcode: optionalDigits("Daraja shortcode"),
    environment: z.enum(DARAJA_ENVIRONMENTS).optional(),
  })
  .strict()
  .refine(
    (value) => Object.keys(value).length > 0,
    "Provide at least one Daraja setting.",
  );

/**
 * Strict PATCH payload. A missing field is left untouched. `null` explicitly
 * clears a stored value; an empty string is rejected so a blank form control
 * can never silently erase a credential.
 */
export const paymentSettingsPatchSchema = z
  .object({
    paybillNumber: optionalDigits("Paybill number"),
    accountFormat: z.enum(ACCOUNT_FORMATS).optional(),
    tillNumber: optionalDigits("Till number"),
    bankName: optionalText("Bank name", 120),
    bankBranch: optionalText("Bank branch", 120),
    bankAccountNumber: optionalBankAccount,
    bankAccountName: optionalText("Bank account name", 120),
    daraja: darajaPatchSchema.optional(),
  })
  .strict()
  .refine(
    (value) => Object.keys(value).length > 0,
    "Provide at least one payment setting.",
  );

export type PaymentSettingsPatch = z.infer<typeof paymentSettingsPatchSchema>;

export type PaymentConfigWrite = {
  paybillNumber?: string | null;
  accountFormat?: string;
  tillNumber?: string | null;
  bankName?: string | null;
  bankBranch?: string | null;
  bankAccountNumber?: string | null;
  bankAccountName?: string | null;
  darajaConsumerKeyEncrypted?: string | null;
  darajaConsumerSecretEncrypted?: string | null;
  darajaPasskeyEncrypted?: string | null;
  darajaShortcode?: string | null;
  darajaEnvironment?: string;
};

export type PaymentConfigRow = {
  id: string;
  schoolId: string;
  paybillNumber: string | null;
  accountFormat: string;
  tillNumber: string | null;
  bankName: string | null;
  bankBranch: string | null;
  bankAccountNumber: string | null;
  bankAccountName: string | null;
  darajaConsumerKeyEncrypted: string | null;
  darajaConsumerSecretEncrypted: string | null;
  darajaPasskeyEncrypted: string | null;
  darajaShortcode: string | null;
  darajaEnvironment: string;
  updatedAt: Date;
};

export type PaymentSettingsView = {
  schoolId: string;
  paybillNumber: string | null;
  accountFormat: string;
  tillNumber: string | null;
  bankName: string | null;
  bankBranch: string | null;
  bankAccountNumber: string | null;
  bankAccountName: string | null;
  updatedAt: string | null;
  daraja: {
    environment: string;
    shortcode: string | null;
    credentialsConfigured: boolean;
    keyAvailable: boolean;
    consumerKeyMasked: string | null;
    consumerSecretMasked: string | null;
    passkeyMasked: string | null;
  };
};

function maskStoredSecret(value: string | null, keyAvailable: boolean): string | null {
  if (!value) return null;
  if (!keyAvailable) return "••••••";
  try {
    return maskSecret(decryptSecret(value));
  } catch {
    // A rotated or invalid key must not turn a stored secret into an error page.
    return "••••••";
  }
}

/** Build the only payment-settings shape that may leave the server. */
export function toPaymentSettingsView(
  schoolId: string,
  config: PaymentConfigRow | null,
  keyAvailable = isPaymentEncryptionConfigured(),
): PaymentSettingsView {
  const credentialsConfigured = Boolean(
    config?.darajaConsumerKeyEncrypted &&
      config.darajaConsumerSecretEncrypted &&
      config.darajaPasskeyEncrypted,
  );

  return {
    schoolId,
    paybillNumber: config?.paybillNumber ?? null,
    accountFormat: config?.accountFormat ?? "ADMISSION_NO",
    tillNumber: config?.tillNumber ?? null,
    bankName: config?.bankName ?? null,
    bankBranch: config?.bankBranch ?? null,
    bankAccountNumber: config?.bankAccountNumber ?? null,
    bankAccountName: config?.bankAccountName ?? null,
    updatedAt: config?.updatedAt.toISOString() ?? null,
    daraja: {
      environment: config?.darajaEnvironment ?? "sandbox",
      shortcode: config?.darajaShortcode ?? null,
      credentialsConfigured,
      keyAvailable,
      consumerKeyMasked: maskStoredSecret(config?.darajaConsumerKeyEncrypted ?? null, keyAvailable),
      consumerSecretMasked: maskStoredSecret(config?.darajaConsumerSecretEncrypted ?? null, keyAvailable),
      passkeyMasked: maskStoredSecret(config?.darajaPasskeyEncrypted ?? null, keyAvailable),
    },
  };
}

/**
 * Convert a validated patch into Prisma data plus the field names to audit.
 * Secret plaintext exists only in this function's local scope and is encrypted
 * before it is returned. Audit callers must log field names, never this data.
 */
export function buildPaymentConfigWrite(patch: PaymentSettingsPatch): {
  data: PaymentConfigWrite;
  fields: string[];
} {
  const data: PaymentConfigWrite = {};
  const fields: string[] = [];

  const direct = [
    "paybillNumber",
    "accountFormat",
    "tillNumber",
    "bankName",
    "bankBranch",
    "bankAccountNumber",
    "bankAccountName",
  ] as const;

  for (const key of direct) {
    if (patch[key] !== undefined) {
      (data as Record<string, unknown>)[key] = patch[key];
      fields.push(key);
    }
  }

  if (patch.daraja) {
    if (patch.daraja.consumerKey !== undefined) {
      data.darajaConsumerKeyEncrypted =
        patch.daraja.consumerKey === null ? null : encryptSecret(patch.daraja.consumerKey);
      fields.push("daraja.consumerKey");
    }
    if (patch.daraja.consumerSecret !== undefined) {
      data.darajaConsumerSecretEncrypted =
        patch.daraja.consumerSecret === null ? null : encryptSecret(patch.daraja.consumerSecret);
      fields.push("daraja.consumerSecret");
    }
    if (patch.daraja.passkey !== undefined) {
      data.darajaPasskeyEncrypted =
        patch.daraja.passkey === null ? null : encryptSecret(patch.daraja.passkey);
      fields.push("daraja.passkey");
    }
    if (patch.daraja.shortcode !== undefined) {
      data.darajaShortcode = patch.daraja.shortcode;
      fields.push("daraja.shortcode");
    }
    if (patch.daraja.environment !== undefined) {
      data.darajaEnvironment = patch.daraja.environment;
      fields.push("daraja.environment");
    }
  }

  return { data, fields };
}

export async function getPaymentSettingsView(schoolId: string): Promise<PaymentSettingsView> {
  const config = await db.schoolPaymentConfig.findUnique({ where: { schoolId } });
  return toPaymentSettingsView(schoolId, config);
}

/** Audit metadata deliberately contains field names only, never values. */
export function paymentAuditMetadata(fields: string[]): string {
  return JSON.stringify({ fields });
}
