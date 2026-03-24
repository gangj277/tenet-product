import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import {
  ELECTRON_LOCAL_USER_EMAIL,
  ELECTRON_LOCAL_USER_ID,
  isElectronRuntime,
} from "@/lib/storage/local-user";

const SESSION_COOKIE = "lumen_session";
const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "lumen-dev-secret-change-in-production"
);

export interface SessionPayload {
  userId: string;
  email: string;
}

export async function createSession(payload: SessionPayload): Promise<string> {
  const token = await new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(SECRET);

  return token;
}

export async function setSessionCookie(token: string) {
  if (isElectronRuntime()) {
    void token;
    return;
  }
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production" && !process.env.ELECTRON,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: "/",
  });
}

export async function getSession(): Promise<SessionPayload | null> {
  if (isElectronRuntime()) {
    return {
      userId: ELECTRON_LOCAL_USER_ID,
      email: ELECTRON_LOCAL_USER_EMAIL,
    };
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, SECRET);
    return {
      userId: payload.userId as string,
      email: payload.email as string,
    };
  } catch {
    return null;
  }
}

export async function clearSession() {
  if (isElectronRuntime()) {
    return;
  }
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}
