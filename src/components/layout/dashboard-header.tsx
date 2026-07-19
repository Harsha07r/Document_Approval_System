"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { RoleBadge } from "@/components/documents/role-badge";
import { useLogout } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import type { SessionUser } from "@/types";

const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/documents", label: "Documents" },
] as const;

export function DashboardHeader({ user }: { user: SessionUser }) {
  const router = useRouter();
  const pathname = usePathname();
  const logout = useLogout();

  function handleLogout() {
    logout.mutate(undefined, {
      onSuccess: () => {
        toast.success("Signed out.");
        router.push("/login");
        router.refresh();
      },
      onError: () => {
        toast.error("Unable to sign out. Please try again.");
      },
    });
  }

  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-center gap-6">
          <span className="text-lg font-semibold">ElevateBox</span>
          <nav className="flex items-center gap-1">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
                  pathname?.startsWith(link.href) ? "bg-accent text-accent-foreground" : "text-muted-foreground",
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex flex-col items-end leading-tight">
            <span className="text-sm font-medium">{user.name}</span>
            <RoleBadge role={user.role} />
          </div>
          <Button variant="outline" size="sm" onClick={handleLogout} disabled={logout.isPending}>
            <LogOut className="h-4 w-4" />
            {logout.isPending ? "Signing out..." : "Logout"}
          </Button>
        </div>
      </div>
    </header>
  );
}
