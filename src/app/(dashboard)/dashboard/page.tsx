"use client";

import * as React from "react";
import { Archive, CheckCircle2, FileEdit, Globe2, RefreshCw, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useDocuments } from "@/hooks/use-documents";
import type { DocumentStatus } from "@/types";

interface StatDefinition {
  status: DocumentStatus;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
}

const STAT_DEFINITIONS: readonly StatDefinition[] = [
  { status: "DRAFT", label: "Draft", icon: FileEdit, accent: "text-slate-500" },
  { status: "SUBMITTED", label: "Submitted", icon: Send, accent: "text-sky-500" },
  { status: "APPROVED", label: "Approved", icon: CheckCircle2, accent: "text-amber-500" },
  { status: "PUBLISHED", label: "Published", icon: Globe2, accent: "text-emerald-500" },
  { status: "ARCHIVED", label: "Archived", icon: Archive, accent: "text-muted-foreground" },
];

export default function DashboardPage() {
  const { data: documents, isLoading, isError, refetch, isFetching } = useDocuments();

  const counts = React.useMemo(() => {
    const initial: Record<DocumentStatus, number> = {
      DRAFT: 0,
      SUBMITTED: 0,
      APPROVED: 0,
      REJECTED: 0,
      PUBLISHED: 0,
      ARCHIVED: 0,
    };

    for (const document of documents ?? []) {
      initial[document.status] += 1;
    }

    return initial;
  }, [documents]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">An overview of documents visible to you.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void refetch()} disabled={isFetching}>
          <RefreshCw className={isFetching ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
          Refresh
        </Button>
      </div>

      {isError ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <p className="text-sm text-muted-foreground">Failed to load statistics.</p>
            <Button variant="outline" size="sm" onClick={() => void refetch()}>
              Try again
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {isLoading
            ? Array.from({ length: 5 }).map((_, index) => (
                <Card key={index}>
                  <CardHeader className="pb-2">
                    <Skeleton className="h-4 w-20" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-8 w-12" />
                  </CardContent>
                </Card>
              ))
            : STAT_DEFINITIONS.map((stat) => {
                const Icon = stat.icon;
                return (
                  <Card key={stat.status}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">{stat.label}</CardTitle>
                      <Icon className={`h-4 w-4 ${stat.accent}`} />
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold">{counts[stat.status]}</div>
                    </CardContent>
                  </Card>
                );
              })}
        </div>
      )}
    </div>
  );
}
