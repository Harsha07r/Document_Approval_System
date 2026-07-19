"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ConflictDialogContextValue {
  notifyConflict: () => void;
}

const ConflictDialogContext = React.createContext<ConflictDialogContextValue | null>(null);

/**
 * A single, app-wide conflict dialog rather than one per mutation call
 * site: every workflow/edit mutation can hit a 409 for the same reason
 * (stale `version`), so there is exactly one place that owns what happens
 * next (refresh the cached document data) instead of each dialog
 * reimplementing its own refresh logic.
 */
export function ConflictDialogProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const queryClient = useQueryClient();

  const notifyConflict = React.useCallback(() => {
    setOpen(true);
  }, []);

  const handleRefresh = React.useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["documents"] });
    setOpen(false);
  }, [queryClient]);

  return (
    <ConflictDialogContext.Provider value={{ notifyConflict }}>
      {children}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" aria-hidden="true" />
              <DialogTitle>This document has changed</DialogTitle>
            </div>
            <DialogDescription>
              Please refresh to see the latest version before trying again.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={handleRefresh}>Refresh</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ConflictDialogContext.Provider>
  );
}

export function useConflictDialog(): ConflictDialogContextValue {
  const context = React.useContext(ConflictDialogContext);
  if (!context) {
    throw new Error("useConflictDialog must be used within a ConflictDialogProvider");
  }
  return context;
}
