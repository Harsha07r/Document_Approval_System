import { z } from "zod";

/**
 * Every state-changing action carries the version the client last read, so
 * the service layer can perform an optimistic-concurrency compare-and-swap
 * against it.
 */
const VersionSchema = z.object({
  version: z.number().int().positive(),
});

export const CreateDocumentSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200, "Title must be 200 characters or fewer"),
  content: z.string().trim().min(1, "Content is required"),
});

export const UpdateDocumentSchema = VersionSchema.extend({
  title: z.string().trim().min(1, "Title is required").max(200, "Title must be 200 characters or fewer").optional(),
  content: z.string().trim().min(1, "Content is required").optional(),
}).refine((data) => data.title !== undefined || data.content !== undefined, {
  message: "At least one of title or content must be provided.",
});

export const SubmitSchema = VersionSchema;

export const ApproveSchema = VersionSchema;

export const RejectSchema = VersionSchema.extend({
  reason: z.string().trim().min(1, "A rejection reason is required").max(1000),
});

export const RevertToDraftSchema = VersionSchema;

export const PublishSchema = VersionSchema;

export const ArchiveSchema = VersionSchema;

export type CreateDocumentInput = z.infer<typeof CreateDocumentSchema>;
export type UpdateDocumentInput = z.infer<typeof UpdateDocumentSchema>;
export type SubmitInput = z.infer<typeof SubmitSchema>;
export type ApproveInput = z.infer<typeof ApproveSchema>;
export type RejectInput = z.infer<typeof RejectSchema>;
export type RevertToDraftInput = z.infer<typeof RevertToDraftSchema>;
export type PublishInput = z.infer<typeof PublishSchema>;
export type ArchiveInput = z.infer<typeof ArchiveSchema>;
