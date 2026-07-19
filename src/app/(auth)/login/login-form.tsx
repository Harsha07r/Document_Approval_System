"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Eye, PenLine, ShieldCheck, SquareCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useLogin } from "@/hooks/use-auth";
import { ApiError } from "@/lib/api-client";
import { cn } from "@/lib/utils";

interface SeededAccount {
  role: string;
  email: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const SEEDED_ACCOUNTS: readonly SeededAccount[] = [
  {
    role: "Author",
    email: "alice@example.com",
    name: "Alice Anderson",
    description: "Creates and submits documents for review.",
    icon: PenLine,
  },
  {
    role: "Reviewer",
    email: "bob@example.com",
    name: "Bob Baker",
    description: "Approves, rejects, and publishes documents.",
    icon: SquareCheck,
  },
  {
    role: "Admin",
    email: "admin@example.com",
    name: "Ada Administrator",
    description: "Full access, including archiving documents.",
    icon: ShieldCheck,
  },
  {
    role: "Viewer",
    email: "viewer@example.com",
    name: "Vince Viewer",
    description: "Read-only access to published documents.",
    icon: Eye,
  },
];

export function LoginForm() {
  const router = useRouter();
  const login = useLogin();
  const [pendingEmail, setPendingEmail] = React.useState<string | null>(null);

  function handleLogin(email: string) {
    setPendingEmail(email);
    login.mutate(email, {
      onSuccess: () => {
        toast.success("Signed in.");
        router.push("/dashboard");
        router.refresh();
      },
      onError: (error) => {
        setPendingEmail(null);
        const message = error instanceof ApiError ? error.message : "Unable to sign in. Please try again.";
        toast.error(message);
      },
    });
  }

  return (
    <div className="grid w-full max-w-4xl grid-cols-1 gap-4 sm:grid-cols-2">
      {SEEDED_ACCOUNTS.map((account) => {
        const Icon = account.icon;
        const isPending = login.isPending && pendingEmail === account.email;

        return (
          <Card
            key={account.email}
            className={cn(
              "transition-shadow hover:shadow-md",
              isPending && "pointer-events-none opacity-70",
            )}
          >
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-base">{account.role}</CardTitle>
                  <CardDescription>{account.name}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">{account.description}</p>
              <Button className="w-full" onClick={() => handleLogin(account.email)} disabled={login.isPending}>
                {isPending ? "Signing in..." : `Continue as ${account.role}`}
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
