import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getDocument } from "@/server/documents/service";
import { toHttpResponse } from "@/server/shared/httpErrors";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * Read-only audit trail for a single document, ordered oldest-first for a
 * chronological timeline. `getDocument` is called first purely for its
 * authorization side effect (NotFoundError/ForbiddenError, including the
 * viewer-published-only rule) so this route never exposes history for a
 * document the caller isn't allowed to see — reusing the existing service
 * rather than re-deriving that policy here.
 */
export async function GET(_request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const { id } = await context.params;
    await getDocument(id);

    const auditLogs = await prisma.auditLog.findMany({
      where: { documentId: id },
      orderBy: { createdAt: "asc" },
      include: {
        actor: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
    });

    return NextResponse.json(auditLogs, { status: 200 });
  } catch (error) {
    return toHttpResponse(error);
  }
}
