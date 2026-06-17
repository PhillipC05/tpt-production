import { z } from "@hono/zod-openapi";
import { designFileSchema } from "./pricing";

export { designFileSchema };

export const ALLOWED_UPLOAD_MIME_TYPES = [
  "model/stl",
  "model/obj",
  "model/3mf",
  "application/octet-stream",
  "application/sla",
  "application/pdf",
  "application/zip",
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;

export const MAX_UPLOAD_BYTES = 100 * 1024 * 1024; // 100 MB

export const designUploadSchema = z.object({
  listingId: z.string().min(1).optional(),
  uploaderId: z.string().min(1),
  fileName: z.string().trim().min(1).max(180),
  fileType: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .refine(
      (t) =>
        ALLOWED_UPLOAD_MIME_TYPES.includes(t as (typeof ALLOWED_UPLOAD_MIME_TYPES)[number]),
      {
        message: `fileType must be one of: ${ALLOWED_UPLOAD_MIME_TYPES.join(", ")}`,
      },
    ),
  fileSizeBytes: z.number().int().positive().max(MAX_UPLOAD_BYTES).optional(),
  drmEnabled: z.boolean().default(true),
});

export const designUploadResponseSchema = designFileSchema.extend({
  uploadUrl: z.string().url(),
  storageProvider: z.enum(["local", "r2"]),
});

export const designRoyaltySchema = z.object({
  id: z.string(),
  designFileId: z.string(),
  orderId: z.string(),
  recipientId: z.string(),
  amount: z.number(),
  credits: z.number().int(),
  paidAt: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
});
