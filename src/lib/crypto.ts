import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const PREFIX = "v1";
const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const TAG_BYTES = 16;

function readKey(): Buffer {
  const raw = process.env.PAYMENT_ENCRYPTION_KEY ?? process.env.ENCRYPTION_MASTER_KEY;
  if (!raw) {
    throw new Error("PAYMENT_ENCRYPTION_KEY is not configured.");
  }
  const key = /^[0-9a-fA-F]{64}$/.test(raw) ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("PAYMENT_ENCRYPTION_KEY must be 32 bytes (base64 or 64 hex characters).");
  }
  return key;
}

export function isPaymentEncryptionConfigured(): boolean {
  try {
    readKey();
    return true;
  } catch {
    return false;
  }
}

/**
 * AES-256-GCM. The returned value is safe to store in a TEXT column:
 * v1:<iv b64>:<tag b64>:<ciphertext b64>
 */
export function encryptSecret(plaintext: string): string {
  if (!plaintext) throw new Error("Cannot encrypt an empty secret.");
  const key = readKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_BYTES });
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}:${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
}

export function decryptSecret(payload: string): string {
  const parts = payload.split(":");
  if (parts.length !== 4 || parts[0] !== PREFIX) {
    throw new Error("Unsupported encrypted secret format.");
  }
  const iv = Buffer.from(parts[1], "base64");
  const tag = Buffer.from(parts[2], "base64");
  const ciphertext = Buffer.from(parts[3], "base64");
  if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) {
    throw new Error("Invalid encrypted secret.");
  }
  const key = readKey();
  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: TAG_BYTES });
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

/** Returns e.g. "••••••3A9f" — never the full secret. */
export function maskSecret(plaintext: string | null | undefined): string | null {
  if (!plaintext) return null;
  const tail = plaintext.length >= 4 ? plaintext.slice(-4) : "";
  return `••••••${tail}`;
}
