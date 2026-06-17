import { z } from "@hono/zod-openapi";
import { paginationMetaSchema } from "./common";

export const creditBalanceSchema = z.object({
  accountId: z.string(),
  userId: z.string(),
  balance: z.number(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const creditTransactionSchema = z.object({
  id: z.string(),
  accountId: z.string(),
  amount: z.number(),
  type: z.enum(["EARNED", "SPENT", "ADJUSTMENT"]),
  note: z.string().optional(),
  createdAt: z.string().datetime(),
});

export const creditTransactionListSchema = z.object({
  data: z.array(creditTransactionSchema),
  meta: paginationMetaSchema,
});
