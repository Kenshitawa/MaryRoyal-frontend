import { SignJWT, jwtVerify } from "jose";

let cachedSecret: Uint8Array | undefined;
function getSecret() {
  if (cachedSecret) return cachedSecret;
  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret || sessionSecret.length < 32 || (process.env.NODE_ENV === "production" && /replace-this|example|change-me/i.test(sessionSecret))) {
    throw new Error("Set a strong SESSION_SECRET of at least 32 characters in the hosting environment.");
  }
  cachedSecret = new TextEncoder().encode(sessionSecret);
  return cachedSecret;
}

export type SchoolSession = {
  id: string;
  schoolId: string;
  schoolSlug: string;
  role: string;
  forcePasswordChange: boolean;
};

export async function makeSession(user: SchoolSession) {
  if (!user.schoolId || !user.schoolSlug) {
    throw new Error("A school session requires both schoolId and schoolSlug.");
  }
  return new SignJWT({
    typ: "school",
    schoolId: user.schoolId,
    schoolSlug: user.schoolSlug,
    role: user.role,
    forcePasswordChange: user.forcePasswordChange,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(getSecret());
}

export async function readSession(token: string): Promise<SchoolSession | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (payload.typ !== "school") return null;
    if (typeof payload.schoolId !== "string" || !payload.schoolId) return null;
    if (typeof payload.schoolSlug !== "string" || !payload.schoolSlug) return null;
    if (typeof payload.sub !== "string" || !payload.sub) return null;
    return {
      id: payload.sub,
      schoolId: payload.schoolId,
      schoolSlug: payload.schoolSlug,
      role: String(payload.role),
      forcePasswordChange: Boolean(payload.forcePasswordChange),
    };
  } catch {
    return null;
  }
}

export async function makeActivitySession(userId: string) {
  return new SignJWT({ kind: "idle", typ: "activity" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(getSecret());
}

export async function readActivitySession(token: string, userId: string) {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload.typ === "activity" && payload.kind === "idle" && payload.sub === userId;
  } catch {
    return false;
  }
}

export async function makeSuperAdminSession(admin: { id: string; email: string }) {
  return new SignJWT({ typ: "platform", isSuperAdmin: true, email: admin.email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(admin.id)
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(getSecret());
}

export async function readSuperAdminSession(token: string) {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (payload.typ !== "platform" || !payload.isSuperAdmin) return null;
    return {
      id: String(payload.sub),
      email: String(payload.email),
      isSuperAdmin: true as const,
    };
  } catch {
    return null;
  }
}
