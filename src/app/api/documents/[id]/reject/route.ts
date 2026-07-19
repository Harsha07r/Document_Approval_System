import { NextResponse } from "next/server";

import { RejectSchema } from "@/server/documents/schemas";
import { rejectDocument } from "@/server/documents/service";
import { toHttpResponse } from "@/server/shared/httpErrors";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const input = RejectSchema.parse(body);
    const document = await rejectDocument(id, input);
    return NextResponse.json(document, { status: 200 });
  } catch (error) {
    return toHttpResponse(error);
  }
}
