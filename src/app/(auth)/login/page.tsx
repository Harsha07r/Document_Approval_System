import { redirect } from "next/navigation";

import { getCurrentUser } from "@/server/auth/session";

import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const user = await getCurrentUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 p-8">
      <div className="text-center">
        <h1 className="text-2xl font-semibold">ElevateBox Document Approval</h1>
        <p className="mt-1 text-muted-foreground">Choose a seeded account to sign in.</p>
      </div>
      <LoginForm />
    </main>
  );
}
