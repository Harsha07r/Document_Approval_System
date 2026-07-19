import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { AppError, ValidationError } from "@/server/shared/errors";

interface ErrorResponseBody {
  error: {
    code: string;
    message: string;
    issues?: readonly string[];
  };
}

/**
 * Single translation point from a thrown error (domain or unexpected) to an
 * HTTP response. Route handlers should funnel every caught error through
 * this function so the client-facing error shape stays consistent across
 * every endpoint.
 */
export function toHttpResponse(error: unknown): NextResponse<ErrorResponseBody> {
  if (error instanceof SyntaxError) {
    return NextResponse.json(
      { error: { code: "INVALID_JSON", message: "The request body must be valid JSON." } },
      { status: 400 },
    );
  }

  if (error instanceof ZodError) {
    const issues = error.issues.map((issue) => `${issue.path.join(".") || "value"}: ${issue.message}`);
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid input.", issues } },
      { status: 422 },
    );
  }

  if (error instanceof ValidationError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message, issues: error.issues } },
      { status: error.statusCode },
    );
  }

  if (error instanceof AppError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message } },
      { status: error.statusCode },
    );
  }

  console.error("Unhandled error:", error);
  return NextResponse.json(
    { error: { code: "INTERNAL_SERVER_ERROR", message: "An unexpected error occurred." } },
    { status: 500 },
  );
}
