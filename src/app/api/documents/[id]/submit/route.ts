import { NextResponse } from "next/server";

import { SubmitSchema } from "@/server/documents/schemas";
import { submitDocument } from "@/server/documents/service";
import { toHttpResponse } from "@/server/shared/httpErrors";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const input = SubmitSchema.parse(body);
    const document = await submitDocument(id, input);
    return NextResponse.json(document, { status: 200 });
  } catch (error) {
    return toHttpResponse(error);
  }
}
