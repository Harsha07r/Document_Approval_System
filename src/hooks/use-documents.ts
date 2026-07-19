"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { apiFetch } from "@/lib/api-client";
import { useMutationErrorHandler } from "@/hooks/use-mutation-error-handler";
import type {
  ApproveInput,
  ArchiveInput,
  CreateDocumentInput,
  PublishInput,
  RejectInput,
  RevertToDraftInput,
  SubmitInput,
  UpdateDocumentInput,
} from "@/server/documents/schemas";
import type { SerializedDocument } from "@/lib/api-types";

const DOCUMENTS_KEY = ["documents"] as const;

export function useDocuments() {
  return useQuery({
    queryKey: DOCUMENTS_KEY,
    queryFn: () => apiFetch<SerializedDocument[]>("/api/documents"),
  });
}

export function useDocument(documentId: string) {
  return useQuery({
    queryKey: [...DOCUMENTS_KEY, documentId],
    queryFn: () => apiFetch<SerializedDocument>(`/api/documents/${documentId}`),
    enabled: Boolean(documentId),
  });
}

/**
 * The only mutation with an explicit optimistic-UI requirement (Create
 * Document Dialog). The placeholder's `allowedNextStatuses` hardcodes the
 * DRAFT row of the workflow transition table — a narrow, transient
 * duplication that only exists until the real server response replaces it
 * in `onSettled`, rather than importing the server's workflow module into
 * client code.
 */
export function useCreateDocument(currentUserId: string) {
  const queryClient = useQueryClient();
  const handleError = useMutationErrorHandler();

  return useMutation({
    mutationFn: (input: CreateDocumentInput) =>
      apiFetch<SerializedDocument>("/api/documents", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: DOCUMENTS_KEY });
      const previous = queryClient.getQueryData<SerializedDocument[]>(DOCUMENTS_KEY);

      const now = new Date().toISOString();
      const optimisticDocument: SerializedDocument = {
        id: `optimistic-${Date.now()}`,
        title: input.title,
        content: input.content,
        status: "DRAFT",
        version: 1,
        authorId: currentUserId,
        createdAt: now,
        updatedAt: now,
        allowedNextStatuses: ["SUBMITTED", "ARCHIVED"],
      };

      queryClient.setQueryData<SerializedDocument[]>(DOCUMENTS_KEY, (old) => [
        optimisticDocument,
        ...(old ?? []),
      ]);

      return { previous };
    },
    onError: (error, _input, context) => {
      if (context?.previous) {
        queryClient.setQueryData(DOCUMENTS_KEY, context.previous);
      }
      handleError(error);
    },
    onSuccess: () => {
      toast.success("Document created.");
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: DOCUMENTS_KEY });
    },
  });
}

export function useUpdateDocument(documentId: string) {
  const queryClient = useQueryClient();
  const handleError = useMutationErrorHandler();

  return useMutation({
    mutationFn: (input: UpdateDocumentInput) =>
      apiFetch<SerializedDocument>(`/api/documents/${documentId}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    onError: handleError,
    onSuccess: () => {
      toast.success("Document updated.");
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: DOCUMENTS_KEY });
    },
  });
}

/**
 * Shared shape for every workflow-transition mutation, mirroring
 * `performTransition` on the server: one implementation, parameterized by
 * endpoint and success copy, instead of six near-identical mutation hooks.
 */
function useDocumentTransition<TInput>(documentId: string, action: string, successMessage: string) {
  const queryClient = useQueryClient();
  const handleError = useMutationErrorHandler();

  return useMutation({
    mutationFn: (input: TInput) =>
      apiFetch<SerializedDocument>(`/api/documents/${documentId}/${action}`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onError: handleError,
    onSuccess: () => {
      toast.success(successMessage);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: DOCUMENTS_KEY });
    },
  });
}

export function useSubmitDocument(documentId: string) {
  return useDocumentTransition<SubmitInput>(documentId, "submit", "Document submitted for review.");
}

export function useApproveDocument(documentId: string) {
  return useDocumentTransition<ApproveInput>(documentId, "approve", "Document approved.");
}

export function useRejectDocument(documentId: string) {
  return useDocumentTransition<RejectInput>(documentId, "reject", "Document rejected.");
}

export function usePublishDocument(documentId: string) {
  return useDocumentTransition<PublishInput>(documentId, "publish", "Document published.");
}

export function useArchiveDocument(documentId: string) {
  return useDocumentTransition<ArchiveInput>(documentId, "archive", "Document archived.");
}

export function useRevertToDraft(documentId: string) {
  return useDocumentTransition<RevertToDraftInput>(documentId, "revert-to-draft", "Document reverted to draft.");
}
