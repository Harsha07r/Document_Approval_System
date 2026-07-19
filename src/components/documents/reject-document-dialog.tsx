"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { useRejectDocument } from "@/hooks/use-documents";
import { RejectSchema, type RejectInput } from "@/server/documents/schemas";

interface RejectDocumentDialogProps {
  documentId: string;
  version: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RejectDocumentDialog({ documentId, version, open, onOpenChange }: RejectDocumentDialogProps) {
  const rejectDocument = useRejectDocument(documentId);

  const form = useForm<RejectInput>({
    resolver: zodResolver(RejectSchema),
    values: { version, reason: "" },
  });

  function onSubmit(values: RejectInput) {
    rejectDocument.mutate(values, {
      onSuccess: () => {
        onOpenChange(false);
        form.reset();
      },
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reject document</DialogTitle>
          <DialogDescription>Let the author know what needs to change before resubmitting.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <input type="hidden" {...form.register("version", { valueAsNumber: true })} />
            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Comment</FormLabel>
                  <FormControl>
                    <Textarea rows={4} placeholder="Explain what needs to change..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="destructive" disabled={rejectDocument.isPending}>
                {rejectDocument.isPending ? "Rejecting..." : "Reject"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
