"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { EditDocumentDialog } from "@/components/documents/edit-document-dialog";
import type { DocumentActionName } from "@/components/documents/get-available-actions";
import { RejectDocumentDialog } from "@/components/documents/reject-document-dialog";
import {
  useApproveDocument,
  useArchiveDocument,
  usePublishDocument,
  useRevertToDraft,
  useSubmitDocument,
} from "@/hooks/use-documents";
import type { SerializedDocument } from "@/lib/api-types";

export function DocumentActions({
  document,
  actions,
}: {
  document: SerializedDocument;
  actions: DocumentActionName[];
}) {
  const [editOpen, setEditOpen] = React.useState(false);
  const [rejectOpen, setRejectOpen] = React.useState(false);

  const submitDocument = useSubmitDocument(document.id);
  const approveDocument = useApproveDocument(document.id);
  const publishDocument = usePublishDocument(document.id);
  const archiveDocument = useArchiveDocument(document.id);
  const revertToDraft = useRevertToDraft(document.id);

  if (actions.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {actions.includes("EDIT") && (
        <Button variant="outline" onClick={() => setEditOpen(true)}>
          Edit
        </Button>
      )}

      {actions.includes("SUBMIT") && (
        <Button
          onClick={() => submitDocument.mutate({ version: document.version })}
          disabled={submitDocument.isPending}
        >
          {submitDocument.isPending ? "Submitting..." : "Submit for Review"}
        </Button>
      )}

      {actions.includes("APPROVE") && (
        <Button
          onClick={() => approveDocument.mutate({ version: document.version })}
          disabled={approveDocument.isPending}
        >
          {approveDocument.isPending ? "Approving..." : "Approve"}
        </Button>
      )}

      {actions.includes("REJECT") && (
        <Button variant="destructive" onClick={() => setRejectOpen(true)}>
          Reject
        </Button>
      )}

      {actions.includes("PUBLISH") && (
        <Button
          onClick={() => publishDocument.mutate({ version: document.version })}
          disabled={publishDocument.isPending}
        >
          {publishDocument.isPending ? "Publishing..." : "Publish"}
        </Button>
      )}

      {actions.includes("REVERT_TO_DRAFT") && (
        <Button
          variant="outline"
          onClick={() => revertToDraft.mutate({ version: document.version })}
          disabled={revertToDraft.isPending}
        >
          {revertToDraft.isPending ? "Reverting..." : "Revert to Draft"}
        </Button>
      )}

      {actions.includes("ARCHIVE") && (
        <Button
          variant="secondary"
          onClick={() => archiveDocument.mutate({ version: document.version })}
          disabled={archiveDocument.isPending}
        >
          {archiveDocument.isPending ? "Archiving..." : "Archive"}
        </Button>
      )}

      <EditDocumentDialog document={document} open={editOpen} onOpenChange={setEditOpen} />
      <RejectDocumentDialog
        documentId={document.id}
        version={document.version}
        open={rejectOpen}
        onOpenChange={setRejectOpen}
      />
    </div>
  );
}
