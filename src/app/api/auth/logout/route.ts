import { NextResponse } from "next/server";

import { logout } from "@/server/auth/session";
import { toHttpResponse } from "@/server/shared/httpErrors";

export async function POST(): Promise<NextResponse> {
  try {
    await logout();
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return toHttpResponse(error);
  }
}
