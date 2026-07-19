"use client";

import * as React from "react";
import Link from "next/link";
import { FileQuestion, Search } from "lucide-react";

import { CreateDocumentDialog } from "@/components/documents/create-document-dialog";
import { StatusBadge } from "@/components/documents/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useDocuments } from "@/hooks/use-documents";
import { useUsers } from "@/hooks/use-users";
import type { DocumentStatus, SessionUser } from "@/types";

const STATUS_OPTIONS: readonly DocumentStatus[] = [
  "DRAFT",
  "SUBMITTED",
  "APPROVED",
  "REJECTED",
  "PUBLISHED",
  "ARCHIVED",
];

const STATUS_LABEL: Record<DocumentStatus, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  PUBLISHED: "Published",
  ARCHIVED: "Archived",
};

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

export function DocumentsClient({ currentUser }: { currentUser: SessionUser }) {
  const { data: documents, isLoading, isError, refetch } = useDocuments();
  const { data: users } = useUsers();

  const [searchTerm, setSearchTerm] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<DocumentStatus | "ALL">("ALL");

  const usersById = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const user of users ?? []) {
      map.set(user.id, user.name);
    }
    return map;
  }, [users]);

  const filteredDocuments = React.useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return (documents ?? []).filter((document) => {
      const matchesStatus = statusFilter === "ALL" || document.status === statusFilter;
      const matchesSearch = normalizedSearch.length === 0 || document.title.toLowerCase().includes(normalizedSearch);
      return matchesStatus && matchesSearch;
    });
  }, [documents, searchTerm, statusFilter]);

  const hasActiveFilters = searchTerm.trim().length > 0 || statusFilter !== "ALL";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Documents</h1>
          <p className="text-sm text-muted-foreground">Browse and manage documents.</p>
        </div>
        <CreateDocumentDialog currentUserId={currentUser.id} />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search by title..."
            className="pl-8"
          />
        </div>
        <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as DocumentStatus | "ALL")}>
          <SelectTrigger className="sm:w-48">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            {STATUS_OPTIONS.map((status) => (
              <SelectItem key={status} value={status}>
                {STATUS_LABEL[status]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {isError ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <p className="text-sm text-muted-foreground">Failed to load documents.</p>
              <Button variant="outline" size="sm" onClick={() => void refetch()}>
                Try again
              </Button>
            </div>
          ) : isLoading ? (
            <div className="space-y-3 p-6">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-10 w-full" />
              ))}
            </div>
          ) : filteredDocuments.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 text-center">
              <FileQuestion className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-medium">
                {hasActiveFilters ? "No matching documents" : "No documents yet"}
              </p>
              <p className="text-sm text-muted-foreground">
                {hasActiveFilters
                  ? "Try a different search term or status filter."
                  : "Create your first document to get started."}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Author</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Updated At</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDocuments.map((document) => (
                  <TableRow key={document.id}>
                    <TableCell className="max-w-xs truncate font-medium">{document.title}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {usersById.get(document.authorId) ?? "Unknown"}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={document.status} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {dateFormatter.format(new Date(document.updatedAt))}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/documents/${document.id}`}>View</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
