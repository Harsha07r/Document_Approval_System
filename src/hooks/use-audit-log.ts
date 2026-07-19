"use client";

import { useQuery } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api-client";
import type { AuditLogEntryDTO } from "@/lib/api-types";

export function useAuditLog(documentId: string) {
  return useQuery({
    queryKey: ["documents", documentId, "audit"],
    queryFn: () => apiFetch<AuditLogEntryDTO[]>(`/api/documents/${documentId}/audit`),
    enabled: Boolean(documentId),
  });
}
