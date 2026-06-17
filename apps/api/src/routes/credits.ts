import { createRoute, z } from "@hono/zod-openapi";
import type { OpenAPIHono } from "@hono/zod-openapi";
import { prisma } from "../lib/prisma";
import { ensureCreditAccount } from "../lib/credits";
import type { AppBindings } from "../types/hono";
import {
  creditBalanceSchema,
  creditTransactionListSchema,
} from "../schemas/credits";

const creditsBalanceRoute = createRoute({
  method: "get",
  path: "/credits/balance",
  request: {
    query: z.object({
      userId: z.string().min(1).openapi({ param: { name: "userId", in: "query" } }),
    }),
  },
  responses: {
    200: {
      description: "Credit balance",
      content: { "application/json": { schema: creditBalanceSchema } },
    },
    404: { description: "User not found" },
  },
  security: [{ bearerAuth: [] }, { apiKey: [] }],
});

const creditsTransactionsRoute = createRoute({
  method: "get",
  path: "/credits/transactions",
  request: {
    query: z.object({
      userId: z.string().min(1).openapi({ param: { name: "userId", in: "query" } }),
      page: z.coerce
        .number()
        .int()
        .min(1)
        .default(1)
        .openapi({ param: { name: "page", in: "query" } }),
      pageSize: z.coerce
        .number()
        .int()
        .min(1)
        .max(100)
        .default(20)
        .openapi({ param: { name: "pageSize", in: "query" } }),
    }),
  },
  responses: {
    200: {
      description: "Credit transactions",
      content: { "application/json": { schema: creditTransactionListSchema } },
    },
    404: { description: "Account not found" },
  },
  security: [{ bearerAuth: [] }, { apiKey: [] }],
});

export function registerCreditsRoutes(app: OpenAPIHono<AppBindings>) {
  app.openapi(creditsBalanceRoute, async (c) => {
    const { userId } = c.req.valid("query");
    const account = await ensureCreditAccount(userId);
    return c.json({
      accountId: account.id,
      userId: account.userId,
      balance: account.balance,
      createdAt: account.createdAt.toISOString(),
      updatedAt: account.updatedAt.toISOString(),
    } as never);
  });

  app.openapi(creditsTransactionsRoute, async (c) => {
    const { userId, page, pageSize } = c.req.valid("query");
    const account = await prisma.creditAccount.findUnique({ where: { userId } });
    if (!account)
      return c.json({ code: "NOT_FOUND", message: "Credit account not found" }, 404) as never;
    const skip = (page - 1) * pageSize;
    const [txs, total] = await Promise.all([
      prisma.creditTransaction.findMany({
        where: { accountId: account.id },
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
      }),
      prisma.creditTransaction.count({ where: { accountId: account.id } }),
    ]);
    return c.json({
      data: txs.map((t) => ({
        id: t.id,
        accountId: t.accountId,
        amount: t.amount,
        type: t.type as "EARNED" | "SPENT" | "ADJUSTMENT",
        ...(t.note ? { note: t.note } : {}),
        createdAt: t.createdAt.toISOString(),
      })),
      meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    } as never);
  });
}
