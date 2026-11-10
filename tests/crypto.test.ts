import { afterEach, describe, expect, it } from "vitest";
import {
  decryptSecret,
  encryptSecret,
  isPaymentEncryptionConfigured,
  maskSecret,
} from "../src/lib/crypto";

const originalKey = process.env.PAYMENT_ENCRYPTION_KEY;
const originalAlias = process.env.ENCRYPTION_MASTER_KEY;
const key = Buffer.alloc(32, 7).toString("base64");

afterEach(() => {
  if (originalKey === undefined) delete process.env.PAYMENT_ENCRYPTION_KEY;
  else process.env.PAYMENT_ENCRYPTION_KEY = originalKey;
  if (originalAlias === undefined) delete process.env.ENCRYPTION_MASTER_KEY;
  else process.env.ENCRYPTION_MASTER_KEY = originalAlias;
});

describe("payment secret encryption", () => {
  it("round-trips a secret with AES-256-GCM and a random IV", () => {
    process.env.PAYMENT_ENCRYPTION_KEY = key;
    const first = encryptSecret("daraja-consumer-secret");
    const second = encryptSecret("daraja-consumer-secret");

    expect(first.startsWith("v1:")).toBe(true);
    expect(first).not.toBe(second);
    expect(decryptSecret(first)).toBe("daraja-consumer-secret");
    expect(decryptSecret(second)).toBe("daraja-consumer-secret");
  });

  it("rejects tampered ciphertext and auth tags", () => {
    process.env.PAYMENT_ENCRYPTION_KEY = key;
    const payload = encryptSecret("passkey-value");
    const parts = payload.split(":");
    const ciphertext = Buffer.from(parts[3], "base64");
    ciphertext[0] ^= 0xff;
    parts[3] = ciphertext.toString("base64");

    expect(() => decryptSecret(parts.join(":"))).toThrow();
  });

  it("supports a 64-character hex key", () => {
    process.env.PAYMENT_ENCRYPTION_KEY = "ab".repeat(32);
    expect(isPaymentEncryptionConfigured()).toBe(true);
    expect(decryptSecret(encryptSecret("hex-key-secret"))).toBe("hex-key-secret");
  });

  it("fails closed when the key is missing or the wrong length", () => {
    delete process.env.PAYMENT_ENCRYPTION_KEY;
    delete process.env.ENCRYPTION_MASTER_KEY;
    expect(isPaymentEncryptionConfigured()).toBe(false);
    expect(() => encryptSecret("secret")).toThrow(/PAYMENT_ENCRYPTION_KEY/);

    process.env.PAYMENT_ENCRYPTION_KEY = Buffer.alloc(16).toString("base64");
    expect(() => encryptSecret("secret")).toThrow(/32 bytes/);
  });

  it("never returns a full secret from the mask helper", () => {
    expect(maskSecret("consumer-secret-3A9f")).toBe("••••••3A9f");
    expect(maskSecret(null)).toBeNull();
    expect(maskSecret("abc")).toBe("••••••");
  });
});
