import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getCurrentUserOrThrow } from "@/server/auth/session";
import { toHttpResponse } from "@/server/shared/httpErrors";

/**
 * A read-only directory of seeded users, used by the frontend to resolve
 * document `authorId`s and audit `actorId`s to display names. Requires an
 * authenticated session but applies no further RBAC: every role already
 * needs to be able to see who authored/actioned a document it can view.
 */
export async function GET(): Promise<NextResponse> {
  try {
    await getCurrentUserOrThrow();

    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(users, { status: 200 });
  } catch (error) {
    return toHttpResponse(error);
  }
}
