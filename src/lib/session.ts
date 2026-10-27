import { SignJWT, jwtVerify } from "jose";
const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret || sessionSecret.length < 32 || process.env.NODE_ENV === "production" && /replace-this|example|change-me/i.test(sessionSecret)) throw new Error("Set a strong SESSION_SECRET of at least 32 characters in the hosting environment.");
const secret = new TextEncoder().encode(sessionSecret);
export async function makeSession(user: { id: string; role: string; forcePasswordChange: boolean }) { return new SignJWT({ role: user.role, forcePasswordChange: user.forcePasswordChange }).setProtectedHeader({ alg: "HS256" }).setSubject(user.id).setIssuedAt().setExpirationTime("8h").sign(secret); }
export async function readSession(token: string) { try { const { payload } = await jwtVerify(token, secret); return { id: payload.sub!, role: String(payload.role), forcePasswordChange: Boolean(payload.forcePasswordChange) }; } catch { return null; } }
export async function makeActivitySession(userId: string) { return new SignJWT({ kind: "idle" }).setProtectedHeader({ alg: "HS256" }).setSubject(userId).setIssuedAt().setExpirationTime("10m").sign(secret); }
export async function readActivitySession(token: string, userId: string) { try { const { payload } = await jwtVerify(token, secret); return payload.kind === "idle" && payload.sub === userId; } catch { return false; } }
