import { NextResponse } from "next/server";

import { UpdateDocumentSchema } from "@/server/documents/schemas";
import { getDocument, updateDocument } from "@/server/documents/service";
import { toHttpResponse } from "@/server/shared/httpErrors";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const { id } = await context.params;
    const document = await getDocument(id);
    return NextResponse.json(document, { status: 200 });
  } catch (error) {
    return toHttpResponse(error);
  }
}

export async function PATCH(request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const input = UpdateDocumentSchema.parse(body);
    const document = await updateDocument(id, input);
    return NextResponse.json(document, { status: 200 });
  } catch (error) {
    return toHttpResponse(error);
  }
}
