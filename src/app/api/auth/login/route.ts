import { NextResponse } from "next/server";
import { z } from "zod";

import { login } from "@/server/auth/session";
import { toHttpResponse } from "@/server/shared/httpErrors";

const LoginSchema = z.object({
  email: z.string().trim().toLowerCase().email("A valid email is required."),
});

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { email } = LoginSchema.parse(body);
    const user = await login(email);
    return NextResponse.json(user, { status: 200 });
  } catch (error) {
    return toHttpResponse(error);
  }
}
