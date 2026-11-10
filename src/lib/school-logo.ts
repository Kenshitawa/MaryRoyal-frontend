import sharp, { type Metadata } from "sharp";
import { deleteStoredFile, writeStoredFile } from "@/lib/file-storage";
import { isValidSlug } from "@/lib/tenant-host";

export const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const ALLOWED_INPUT_FORMATS = new Set(["png", "jpeg", "webp"]);

export class LogoValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LogoValidationError";
  }
}

export type StoredSchoolLogo = {
  /** Public, same-origin URL safe to persist in School.logoUrl. */
  url: string;
  /** Private storage key; never exposed to the browser. */
  key: string;
  width: number;
  height: number;
  bytes: number;
};

/**
 * Validate, normalise and store a school logo as WebP. The file is written to
 * private storage and served through an authenticated-by-slug public route.
 * The deterministic key is safe because slugs are immutable and unique.
 */
export async function storeSchoolLogo(slug: string, file: File): Promise<StoredSchoolLogo> {
  if (!isValidSlug(slug)) throw new LogoValidationError("Choose a valid school subdomain first.");

  if (file.size === 0) throw new LogoValidationError("Choose a school logo to upload.");
  if (file.size > MAX_LOGO_BYTES) throw new LogoValidationError("The logo must be 2 MB or smaller.");

  const input = Buffer.from(await file.arrayBuffer());
  if (input.length === 0) throw new LogoValidationError("Choose a school logo to upload.");

  let metadata: Metadata;
  try {
    metadata = await sharp(input, { limitInputPixels: 40_000_000 }).metadata();
  } catch {
    throw new LogoValidationError("The selected file is not a readable image.");
  }

  if (!metadata.format || !ALLOWED_INPUT_FORMATS.has(metadata.format)) {
    throw new LogoValidationError("Use a PNG, JPEG or WebP logo.");
  }
  if (!metadata.width || !metadata.height || metadata.width < 32 || metadata.height < 32) {
    throw new LogoValidationError("The logo must be at least 32 × 32 pixels.");
  }

  let output: Buffer;
  try {
    output = await sharp(input, { limitInputPixels: 40_000_000 })
      .rotate()
      .resize(512, 512, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 84, effort: 4 })
      .toBuffer();
  } catch {
    throw new LogoValidationError("The selected image could not be processed.");
  }

  const key = `school-logos/${slug}.webp`;

  // Provisioning is retryable. A retry replaces the previous attempt's logo
  // rather than failing on the storage layer's no-overwrite guarantee.
  try {
    await writeStoredFile("private", key, output, "image/webp");
  } catch (error) {
    const code = error instanceof Error ? (error as NodeJS.ErrnoException).code : undefined;
    if (code === "EEXIST") {
      await deleteStoredFile("private", key);
      await writeStoredFile("private", key, output, "image/webp");
    } else {
      throw error;
    }
  }

  return {
    url: `/api/public/school-logo/${slug}`,
    key,
    width: metadata.width,
    height: metadata.height,
    bytes: output.length,
  };
}

/** Best-effort cleanup used when a provisioning transaction rolls back. */
export async function removeSchoolLogo(slug: string): Promise<void> {
  if (!isValidSlug(slug)) return;
  try {
    await deleteStoredFile("private", `school-logos/${slug}.webp`);
  } catch {
    // The logo may never have been written.
  }
}

/** Used by tests to generate a deterministic key without touching storage. */
export function schoolLogoKey(slug: string): string {
  return `school-logos/${slug}.webp`;
}
