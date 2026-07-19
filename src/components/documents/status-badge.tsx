import { Badge, type BadgeProps } from "@/components/ui/badge";
import type { DocumentStatus } from "@/types";

const STATUS_VARIANT: Record<DocumentStatus, NonNullable<BadgeProps["variant"]>> = {
  DRAFT: "secondary",
  SUBMITTED: "info",
  APPROVED: "warning",
  REJECTED: "destructive",
  PUBLISHED: "success",
  ARCHIVED: "outline",
};

const STATUS_LABEL: Record<DocumentStatus, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  PUBLISHED: "Published",
  ARCHIVED: "Archived",
};

export function StatusBadge({ status }: { status: DocumentStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>;
}
