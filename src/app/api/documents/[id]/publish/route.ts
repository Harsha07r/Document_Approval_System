import { NextResponse } from "next/server";

import { PublishSchema } from "@/server/documents/schemas";
import { publishDocument } from "@/server/documents/service";
import { toHttpResponse } from "@/server/shared/httpErrors";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const input = PublishSchema.parse(body);
    const document = await publishDocument(id, input);
    return NextResponse.json(document, { status: 200 });
  } catch (error) {
    return toHttpResponse(error);
  }
}
