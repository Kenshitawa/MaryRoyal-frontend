import { afterEach, describe, expect, it } from "vitest";
import {
  buildPaymentConfigWrite,
  paymentAuditMetadata,
  paymentSettingsPatchSchema,
  toPaymentSettingsView,
  type PaymentConfigRow,
} from "../src/lib/payment-settings";
import { decryptSecret } from "../src/lib/crypto";

const originalKey = process.env.PAYMENT_ENCRYPTION_KEY;
const originalAlias = process.env.ENCRYPTION_MASTER_KEY;
const key = Buffer.alloc(32, 11).toString("base64");

afterEach(() => {
  if (originalKey === undefined) delete process.env.PAYMENT_ENCRYPTION_KEY;
  else process.env.PAYMENT_ENCRYPTION_KEY = originalKey;
  if (originalAlias === undefined) delete process.env.ENCRYPTION_MASTER_KEY;
  else process.env.ENCRYPTION_MASTER_KEY = originalAlias;
});

function row(overrides: Partial<PaymentConfigRow> = {}): PaymentConfigRow {
  return {
    id: "paycfg_1",
    schoolId: "school_test",
    paybillNumber: "522123",
    accountFormat: "ADMISSION_NO",
    tillNumber: null,
    bankName: "KCB Bank",
    bankBranch: "Kisumu",
    bankAccountNumber: "1234567890",
    bankAccountName: "Test School",
    darajaConsumerKeyEncrypted: null,
    darajaConsumerSecretEncrypted: null,
    darajaPasskeyEncrypted: null,
    darajaShortcode: "522123",
    darajaEnvironment: "sandbox",
    updatedAt: new Date("2026-11-10T09:00:00.000Z"),
    ...overrides,
  };
}

describe("payment settings validation", () => {
  it("accepts a full strict payload and trims values", () => {
    const parsed = paymentSettingsPatchSchema.parse({
      paybillNumber: " 522123 ",
      accountFormat: "ADMISSION_NO",
      tillNumber: "",
      bankName: " KCB Bank ",
      bankBranch: "Kisumu",
      bankAccountNumber: "1234-5678",
      bankAccountName: "Test School",
      daraja: {
        consumerKey: " consumer-key-value ",
        consumerSecret: "consumer-secret-value",
        passkey: "passkey-value",
        shortcode: "522123",
        environment: "production",
      },
    });

    expect(parsed.paybillNumber).toBe("522123");
    expect(parsed.tillNumber).toBeNull();
    expect(parsed.bankName).toBe("KCB Bank");
    expect(parsed.daraja?.consumerKey).toBe("consumer-key-value");
    expect(parsed.daraja?.environment).toBe("production");
  });

  it("uses null as the explicit clear value and rejects blank secrets", () => {
    const cleared = paymentSettingsPatchSchema.parse({ paybillNumber: null });
    expect(cleared.paybillNumber).toBeNull();

    expect(() =>
      paymentSettingsPatchSchema.parse({ daraja: { consumerKey: "" } }),
    ).toThrow();
    expect(() =>
      paymentSettingsPatchSchema.parse({ daraja: { consumerKey: null } }),
    ).not.toThrow();
  });

  it("rejects unknown fields, invalid numbers and empty patches", () => {
    expect(() =>
      paymentSettingsPatchSchema.parse({ paybillNumber: "ABC123" }),
    ).toThrow();
    expect(() =>
      paymentSettingsPatchSchema.parse({ paybillNumber: "1234" }),
    ).toThrow();
    expect(() =>
      paymentSettingsPatchSchema.parse({ schoolId: "school_other" }),
    ).toThrow();
    expect(() => paymentSettingsPatchSchema.parse({})).toThrow();
    expect(() => paymentSettingsPatchSchema.parse({ daraja: {} })).toThrow();
    expect(() =>
      paymentSettingsPatchSchema.parse({ daraja: { environment: "live" } }),
    ).toThrow();
  });
});

describe("payment settings writes", () => {
  it("encrypts secrets, leaves omitted fields untouched and records field names", () => {
    process.env.PAYMENT_ENCRYPTION_KEY = key;
    const { data, fields } = buildPaymentConfigWrite(
      paymentSettingsPatchSchema.parse({
        paybillNumber: "522123",
        daraja: { consumerSecret: "super-secret-value", shortcode: null },
      }),
    );

    expect(data.paybillNumber).toBe("522123");
    expect(data.darajaShortcode).toBeNull();
    expect(data.darajaConsumerKeyEncrypted).toBeUndefined();
    expect(data.darajaConsumerSecretEncrypted).toMatch(/^v1:/);
    expect(decryptSecret(data.darajaConsumerSecretEncrypted as string)).toBe(
      "super-secret-value",
    );
    expect(fields).toEqual(["paybillNumber", "daraja.consumerSecret", "daraja.shortcode"]);
  });

  it("clears a stored secret only when null is supplied", () => {
    process.env.PAYMENT_ENCRYPTION_KEY = key;
    const { data, fields } = buildPaymentConfigWrite(
      paymentSettingsPatchSchema.parse({ daraja: { passkey: null } }),
    );

    expect(data.darajaPasskeyEncrypted).toBeNull();
    expect(fields).toEqual(["daraja.passkey"]);
  });

  it("fails closed when the encryption key is missing", () => {
    delete process.env.PAYMENT_ENCRYPTION_KEY;
    delete process.env.ENCRYPTION_MASTER_KEY;
    expect(() =>
      buildPaymentConfigWrite(
        paymentSettingsPatchSchema.parse({ daraja: { consumerKey: "consumer-key-value" } }),
      ),
    ).toThrow(/PAYMENT_ENCRYPTION_KEY/);
  });
});

describe("payment settings views", () => {
  it("returns masked secrets only and never serialises ciphertext", () => {
    process.env.PAYMENT_ENCRYPTION_KEY = key;
    const view = toPaymentSettingsView(
      "school_test",
      row({
        darajaConsumerKeyEncrypted: buildPaymentConfigWrite(
          paymentSettingsPatchSchema.parse({ daraja: { consumerKey: "consumer-key-3A9f" } }),
        ).data.darajaConsumerKeyEncrypted,
        darajaConsumerSecretEncrypted: buildPaymentConfigWrite(
          paymentSettingsPatchSchema.parse({ daraja: { consumerSecret: "consumer-secret-7B2c" } }),
        ).data.darajaConsumerSecretEncrypted,
        darajaPasskeyEncrypted: buildPaymentConfigWrite(
          paymentSettingsPatchSchema.parse({ daraja: { passkey: "passkey-value-1D4e" } }),
        ).data.darajaPasskeyEncrypted,
      }),
    );

    expect(view.daraja.credentialsConfigured).toBe(true);
    expect(view.daraja.consumerKeyMasked).toBe("••••••3A9f");
    expect(view.daraja.consumerSecretMasked).toBe("••••••7B2c");
    expect(view.daraja.passkeyMasked).toBe("••••••1D4e");
    expect(view.daraja.keyAvailable).toBe(true);

    const serialised = JSON.stringify(view);
    expect(serialised).not.toContain("consumer-key-3A9f");
    expect(serialised).not.toContain("v1:");
    expect(serialised).not.toContain("darajaConsumerKeyEncrypted");
  });

  it("never exposes a secret when the server key is unavailable", () => {
    delete process.env.PAYMENT_ENCRYPTION_KEY;
    delete process.env.ENCRYPTION_MASTER_KEY;
    const view = toPaymentSettingsView(
      "school_test",
      row({
        darajaConsumerKeyEncrypted: "v1:invalid:invalid:invalid",
        darajaConsumerSecretEncrypted: "v1:invalid:invalid:invalid",
        darajaPasskeyEncrypted: "v1:invalid:invalid:invalid",
      }),
    );

    expect(view.daraja.keyAvailable).toBe(false);
    expect(view.daraja.credentialsConfigured).toBe(true);
    expect(view.daraja.consumerKeyMasked).toBe("••••••");
    expect(JSON.stringify(view)).not.toContain("invalid");
  });

  it("audits field names only", () => {
    const metadata = paymentAuditMetadata(["paybillNumber", "daraja.consumerSecret"]);
    expect(JSON.parse(metadata)).toEqual({
      fields: ["paybillNumber", "daraja.consumerSecret"],
    });
    expect(metadata).not.toContain("secret-value");
  });
});
