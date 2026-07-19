import { NextResponse } from "next/server";

import { CreateDocumentSchema } from "@/server/documents/schemas";
import { createDocument, listDocuments } from "@/server/documents/service";
import { toHttpResponse } from "@/server/shared/httpErrors";

export async function GET(): Promise<NextResponse> {
  try {
    const documents = await listDocuments();
    return NextResponse.json(documents, { status: 200 });
  } catch (error) {
    return toHttpResponse(error);
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = await request.json();
    const input = CreateDocumentSchema.parse(body);
    const document = await createDocument(input);
    return NextResponse.json(document, { status: 201 });
  } catch (error) {
    return toHttpResponse(error);
  }
}
