"use client";

import { AlertCircle } from "lucide-react";

import { StatusBadge } from "@/components/documents/status-badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuditLog } from "@/hooks/use-audit-log";
import type { AuditAction } from "@/types";

const ACTION_LABEL: Record<AuditAction, string> = {
  CREATE: "Created",
  SUBMIT: "Submitted for review",
  APPROVE: "Approved",
  REJECT: "Rejected",
  REVERT_TO_DRAFT: "Reverted to draft",
  PUBLISH: "Published",
  ARCHIVE: "Archived",
};

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

export function AuditTimeline({ documentId }: { documentId: string }) {
  const { data: entries, isLoading, isError, refetch } = useAuditLog(documentId);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-14 w-full" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-center">
        <AlertCircle className="h-6 w-6 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Failed to load audit history.</p>
        <Button variant="outline" size="sm" onClick={() => void refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  if (!entries || entries.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">No activity recorded yet.</p>;
  }

  return (
    <ol className="relative space-y-6 border-l-2 border-border pl-6">
      {entries.map((entry) => (
        <li key={entry.id} className="relative">
          <span className="absolute -left-[1.6rem] top-1 h-3 w-3 rounded-full border-2 border-background bg-primary" />
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-medium">{entry.actor.name}</span>
            <span className="text-sm text-muted-foreground">{ACTION_LABEL[entry.action]}</span>
            <div className="flex items-center gap-1.5">
              {entry.fromStatus ? (
                <>
                  <StatusBadge status={entry.fromStatus} />
                  <span aria-hidden="true" className="text-muted-foreground">
                    &rarr;
                  </span>
                </>
              ) : null}
              <StatusBadge status={entry.toStatus} />
            </div>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{dateFormatter.format(new Date(entry.createdAt))}</p>
          {entry.metadata?.reason ? (
            <blockquote className="mt-2 rounded-md border-l-2 border-muted-foreground/30 bg-muted/40 px-3 py-2 text-sm italic text-muted-foreground">
              &ldquo;{entry.metadata.reason}&rdquo;
            </blockquote>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
