import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";

function supabaseStorage() {
  if (process.env.OBJECT_STORAGE_DRIVER !== "supabase") return null;
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET;
  if (!url || !serviceKey || !bucket || bucket.includes("/")) throw new Error("Object storage is not configured.");
  return { url, serviceKey, bucket };
}

function storageAuthHeaders(config: NonNullable<ReturnType<typeof supabaseStorage>>) {
  const headers: Record<string, string> = { apikey: config.serviceKey };
  // Supabase's current sb_secret_* keys are opaque API keys, not JWTs. Sending
  // one as a Bearer token makes the gateway reject it as an invalid JWT.
  // Legacy service_role keys are JWTs and still need the Authorization header.
  if (!config.serviceKey.startsWith("sb_secret_")) {
    headers.authorization = `Bearer ${config.serviceKey}`;
  }
  return headers;
}

function objectUrl(config: NonNullable<ReturnType<typeof supabaseStorage>>, operation: "object" | "object/authenticated", key: string) {
  const objectKey = key.split("/").map(encodeURIComponent).join("/");
  return `${config.url}/storage/v1/${operation}/${encodeURIComponent(config.bucket)}/${objectKey}`;
}

function rootFor(kind: "private" | "assignments" | "avatars") {
  const configured = kind === "assignments" ? process.env.UPLOADS_DIR : process.env.PRIVATE_UPLOADS_DIR;
  const root = configured || (kind === "private" ? "private-uploads" : "private-uploads");
  return isAbsolute(root) ? resolve(root) : resolve(process.cwd(), root);
}

function safeKey(key: string) {
  if (!/^[a-z0-9_-]+(?:\/[a-z0-9_-]+)*\.[a-z0-9]{1,8}$/i.test(key)) throw new Error("Invalid file key.");
  return key;
}

export async function writeStoredFile(kind: "private" | "assignments" | "avatars", key: string, bytes: Uint8Array, contentType = "application/octet-stream") {
  const safe = safeKey(kind === "private" ? key : `${kind}/${key}`);
  const storage = supabaseStorage();
  if (storage) {
    const response = await fetch(objectUrl(storage, "object", safe), { method: "POST", headers: { ...storageAuthHeaders(storage), "content-type": contentType, "x-upsert": "false" }, body: Buffer.from(bytes), signal: AbortSignal.timeout(20_000) });
    if (!response.ok) throw new Error("Object storage upload failed.");
    return;
  }
  const path = resolve(rootFor(kind), safeKey(key));
  const relativePath = relative(rootFor(kind), path);
  if (relativePath.startsWith("..") || isAbsolute(relativePath)) throw new Error("Invalid file path.");
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, bytes, { flag: "wx" });
}

export async function readStoredFile(kind: "private" | "assignments" | "avatars", key: string) {
  const safe = safeKey(kind === "private" ? key : `${kind}/${key}`);
  const storage = supabaseStorage();
  if (storage) {
    const response = await fetch(objectUrl(storage, "object/authenticated", safe), { headers: storageAuthHeaders(storage), signal: AbortSignal.timeout(20_000), cache: "no-store" });
    if (!response.ok) throw new Error("Object storage read failed.");
    return Buffer.from(await response.arrayBuffer());
  }
  const root = rootFor(kind);
  const path = resolve(root, safeKey(key));
  const relativePath = relative(root, path);
  if (relativePath.startsWith("..") || isAbsolute(relativePath)) throw new Error("Invalid file path.");
  return readFile(path);
}

export async function deleteStoredFile(kind: "private" | "assignments" | "avatars", key: string) {
  const safe = safeKey(kind === "private" ? key : `${kind}/${key}`);
  const storage = supabaseStorage();
  if (storage) {
    const response = await fetch(`${storage.url}/storage/v1/object/${encodeURIComponent(storage.bucket)}`, { method: "DELETE", headers: { ...storageAuthHeaders(storage), "content-type": "application/json" }, body: JSON.stringify({ prefixes: [safe] }), signal: AbortSignal.timeout(20_000) });
    if (!response.ok) throw new Error("Object storage deletion failed.");
    return;
  }
  const root = rootFor(kind);
  const path = resolve(root, safeKey(key));
  const relativePath = relative(root, path);
  if (relativePath.startsWith("..") || isAbsolute(relativePath)) throw new Error("Invalid file path.");
  await unlink(path);
}

