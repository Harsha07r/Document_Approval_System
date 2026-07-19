import { Badge, type BadgeProps } from "@/components/ui/badge";
import type { Role } from "@/types";

const ROLE_VARIANT: Record<Role, NonNullable<BadgeProps["variant"]>> = {
  AUTHOR: "info",
  REVIEWER: "warning",
  ADMIN: "default",
  VIEWER: "secondary",
};

const ROLE_LABEL: Record<Role, string> = {
  AUTHOR: "Author",
  REVIEWER: "Reviewer",
  ADMIN: "Admin",
  VIEWER: "Viewer",
};

export function RoleBadge({ role }: { role: Role }) {
  return <Badge variant={ROLE_VARIANT[role]}>{ROLE_LABEL[role]}</Badge>;
}
