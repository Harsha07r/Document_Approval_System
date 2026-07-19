import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";

import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { UnauthorizedError } from "@/server/shared/errors";
import { isExpired } from "@/server/shared/utils";
import type { SessionUser, User } from "@/types";

const SESSION_DURATION_MS = env.SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000;

function generateSessionToken(): string {
  return randomBytes(32).toString("hex");
}

function toSessionUser(user: User): SessionUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  };
}

// --- Cookie helpers -------------------------------------------------------

async function setSessionCookie(token: string, expiresAt: Date): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(env.SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    expires: expiresAt,
    path: "/",
  });
}

async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(env.SESSION_COOKIE_NAME);
}

async function readSessionToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(env.SESSION_COOKIE_NAME)?.value ?? null;
}

// --- Session lifecycle -----------------------------------------------------

/**
 * "Simple seeded session authentication": there is no password check. The
 * four users are pre-seeded, and logging in as one of them just means
 * proving you know their email. A real session row is still created and a
 * real httpOnly cookie is still issued, so every other part of the system
 * (RBAC, audit attribution) works exactly as it would against a full
 * credentialed auth flow.
 */
export async function login(email: string): Promise<SessionUser> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new UnauthorizedError("No account found for this email.");
  }

  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  await prisma.session.create({
    data: { token, userId: user.id, expiresAt },
  });

  await setSessionCookie(token, expiresAt);

  return toSessionUser(user);
}

export async function logout(): Promise<void> {
  const token = await readSessionToken();

  if (token) {
    await prisma.session.deleteMany({ where: { token } });
  }

  await clearSessionCookie();
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const token = await readSessionToken();
  if (!token) {
    return null;
  }

  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!session) {
    return null;
  }

  if (isExpired(session.expiresAt)) {
    await prisma.session.delete({ where: { id: session.id } });
    await clearSessionCookie();
    return null;
  }

  return toSessionUser(session.user);
}

export async function getCurrentUserOrThrow(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new UnauthorizedError();
  }
  return user;
}
