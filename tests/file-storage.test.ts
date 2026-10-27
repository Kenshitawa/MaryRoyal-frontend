import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { deleteStoredFile, readStoredFile, writeStoredFile } from "../src/lib/file-storage";

const original = {
  objectDriver: process.env.OBJECT_STORAGE_DRIVER,
  privateDir: process.env.PRIVATE_UPLOADS_DIR,
  uploadsDir: process.env.UPLOADS_DIR,
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  bucket: process.env.SUPABASE_STORAGE_BUCKET,
};
const restore = (name: string, value: string | undefined) => value === undefined ? delete process.env[name] : (process.env[name] = value);

afterEach(() => {
  restore("OBJECT_STORAGE_DRIVER", original.objectDriver);
  restore("PRIVATE_UPLOADS_DIR", original.privateDir);
  restore("UPLOADS_DIR", original.uploadsDir);
  restore("SUPABASE_URL", original.supabaseUrl);
  restore("SUPABASE_SERVICE_ROLE_KEY", original.supabaseKey);
  restore("SUPABASE_STORAGE_BUCKET", original.bucket);
  vi.unstubAllGlobals();
});

describe("file storage", () => {
  it("stores local private files outside the public tree and removes them", async () => {
    const root = await mkdtemp(join(tmpdir(), "mary-royal-storage-"));
    process.env.OBJECT_STORAGE_DRIVER = "local";
    process.env.PRIVATE_UPLOADS_DIR = root;
    const payload = Buffer.from("private test file");
    try {
      await writeStoredFile("private", "admissions/draft/file.pdf", payload, "application/pdf");
      expect(await readStoredFile("private", "admissions/draft/file.pdf")).toEqual(payload);
      await deleteStoredFile("private", "admissions/draft/file.pdf");
      await expect(readFile(join(root, "admissions", "draft", "file.pdf"))).rejects.toThrow();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects traversal keys before touching storage", async () => {
    process.env.OBJECT_STORAGE_DRIVER = "local";
    await expect(readStoredFile("private", "../secret.txt")).rejects.toThrow("Invalid file key");
  });

  it("uses the configured private Supabase bucket for upload, read and removal", async () => {
    process.env.OBJECT_STORAGE_DRIVER = "supabase";
    process.env.SUPABASE_URL = "https://school.example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "sb_secret_test_opaque_key";
    process.env.SUPABASE_STORAGE_BUCKET = "mary-royal-private";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response("{}", { status: 200 }))
      .mockResolvedValueOnce(new Response("uploaded test", { status: 200 }))
      .mockResolvedValueOnce(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await writeStoredFile("private", "admissions/draft/file.pdf", Buffer.from("upload"), "application/pdf");
    expect(await readStoredFile("private", "admissions/draft/file.pdf")).toEqual(Buffer.from("uploaded test"));
    await deleteStoredFile("private", "admissions/draft/file.pdf");
    expect(fetchMock.mock.calls.map(([url, init]) => [String(url), (init as RequestInit).method])).toEqual([
      ["https://school.example.supabase.co/storage/v1/object/mary-royal-private/admissions/draft/file.pdf", "POST"],
      ["https://school.example.supabase.co/storage/v1/object/authenticated/mary-royal-private/admissions/draft/file.pdf", undefined],
      ["https://school.example.supabase.co/storage/v1/object/mary-royal-private", "DELETE"],
    ]);
    for (const [, init] of fetchMock.mock.calls) {
      const headers = new Headers((init as RequestInit).headers);
      expect(headers.get("apikey")).toBe("sb_secret_test_opaque_key");
      expect(headers.has("authorization")).toBe(false);
    }
  });

  it("keeps bearer authorization for legacy JWT service-role keys", async () => {
    process.env.OBJECT_STORAGE_DRIVER = "supabase";
    process.env.SUPABASE_URL = "https://school.example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "eyJ.legacy.service-role";
    process.env.SUPABASE_STORAGE_BUCKET = "mary-royal-private";
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await writeStoredFile("private", "admissions/draft/file.pdf", Buffer.from("upload"), "application/pdf");
    const headers = new Headers((fetchMock.mock.calls[0][1] as RequestInit).headers);
    expect(headers.get("apikey")).toBe("eyJ.legacy.service-role");
    expect(headers.get("authorization")).toBe("Bearer eyJ.legacy.service-role");
  });
});

