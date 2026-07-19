"use client";

import { toast } from "sonner";

import { useConflictDialog } from "@/components/conflict-dialog";
import { ApiError } from "@/lib/api-client";

/**
 * The single place that decides how a failed mutation is surfaced: a 409
 * (stale `version`) opens the app-wide conflict dialog in addition to a
 * toast, a 422 shows the specific field issues from the server's Zod
 * validation, and everything else (401/403/404/500) falls back to a plain
 * error toast with the server's message. Every mutation hook passes its
 * `onError` through this so that behavior never has to be re-decided per
 * call site.
 */
export function useMutationErrorHandler(): (error: unknown) => void {
  const { notifyConflict } = useConflictDialog();

  return (error: unknown) => {
    if (error instanceof ApiError) {
      if (error.status === 409) {
        toast.error("This document has changed.", {
          description: "Please refresh to see the latest version.",
        });
        notifyConflict();
        return;
      }

      if (error.status === 422 && error.issues && error.issues.length > 0) {
        toast.error("Please check the form.", {
          description: error.issues.join(" "),
        });
        return;
      }

      toast.error(error.message);
      return;
    }

    toast.error("Something went wrong. Please try again.");
  };
}
