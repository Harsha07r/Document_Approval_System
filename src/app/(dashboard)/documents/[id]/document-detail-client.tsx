"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { AuditTimeline } from "@/components/documents/audit-timeline";
import { DocumentActions } from "@/components/documents/document-actions";
import { getAvailableActions } from "@/components/documents/get-available-actions";
import { StatusBadge } from "@/components/documents/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useDocument } from "@/hooks/use-documents";
import { useUsers } from "@/hooks/use-users";
import { ApiError } from "@/lib/api-client";
import type { SessionUser } from "@/types";

const dateFormatter = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" });

export function DocumentDetailClient({
  documentId,
  currentUser,
}: {
  documentId: string;
  currentUser: SessionUser;
}) {
  const { data: document, isLoading, isError, error, refetch } = useDocument(documentId);
  const { data: users } = useUsers();

  const authorName = users?.find((user) => user.id === document?.authorId)?.name ?? "Unknown";

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (isError || !document) {
    const status = error instanceof ApiError ? error.status : null;
    const message =
      status === 404
        ? "This document doesn't exist or has been removed."
        : status === 403
          ? "You don't have permission to view this document."
          : "Failed to load this document.";
    const canRetry = status !== 404 && status !== 403;

    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
          <p className="text-sm text-muted-foreground">{message}</p>
          <div className="flex gap-2">
            {canRetry ? (
              <Button variant="outline" size="sm" onClick={() => void refetch()}>
                Try again
              </Button>
            ) : null}
            <Button asChild size="sm">
              <Link href="/documents">Back to Documents</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const availableActions = getAvailableActions(currentUser, document);

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/documents">
          <ArrowLeft className="h-4 w-4" />
          Back to Documents
        </Link>
      </Button>

      <Card>
        <CardHeader className="space-y-3">
          <div>
            <CardTitle className="text-2xl">{document.title}</CardTitle>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <StatusBadge status={document.status} />
              <span className="text-xs text-muted-foreground">Version {document.version}</span>
            </div>
          </div>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-1 text-sm text-muted-foreground sm:grid-cols-3">
            <div>
              <dt className="font-medium text-foreground">Author</dt>
              <dd>{authorName}</dd>
            </div>
            <div>
              <dt className="font-medium text-foreground">Created</dt>
              <dd>{dateFormatter.format(new Date(document.createdAt))}</dd>
            </div>
            <div>
              <dt className="font-medium text-foreground">Updated</dt>
              <dd>{dateFormatter.format(new Date(document.updatedAt))}</dd>
            </div>
          </dl>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="whitespace-pre-wrap rounded-md border bg-muted/30 p-4 text-sm leading-relaxed">
            {document.content}
          </div>
          <DocumentActions document={document} actions={availableActions} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <AuditTimeline documentId={document.id} />
        </CardContent>
      </Card>
    </div>
  );
}
