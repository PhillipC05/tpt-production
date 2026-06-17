import { createRoute } from "@hono/zod-openapi";
import type { OpenAPIHono } from "@hono/zod-openapi";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { DesignUploadResponse } from "@tpt/types";
import { prisma } from "../lib/prisma";
import { requireDesignAccess } from "../lib/auth";
import { designFileToResponse } from "../lib/mappers";
import { createFileKey, createUploadUrl, getLocalUploadDir } from "../lib/upload";
import type { AppBindings } from "../types/hono";
import { idParamSchema } from "../schemas/common";
import {
  designFileSchema,
  designUploadSchema,
  designUploadResponseSchema,
  designRoyaltySchema,
} from "../schemas/designs";

const uploadDesignRoute = createRoute({
  method: "post",
  path: "/designs/upload",
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: designUploadSchema } },
    },
  },
  responses: {
    202: {
      description: "Design file record created with upload URL",
      content: { "application/json": { schema: designUploadResponseSchema } },
    },
    400: { description: "Invalid listing reference" },
  },
});

const getDesignRoute = createRoute({
  method: "get",
  path: "/designs/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "Design metadata",
      content: { "application/json": { schema: designFileSchema } },
    },
    403: { description: "DRM authorization required" },
    404: { description: "Design not found" },
  },
  security: [{ bearerAuth: [] }, { apiKey: [] }],
});

const getDesignRoyaltiesRoute = createRoute({
  method: "get",
  path: "/designs/{id}/royalties",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "Royalties for this design",
      content: { "application/json": { schema: designRoyaltySchema.array() } },
    },
    404: { description: "Design not found" },
  },
  security: [{ bearerAuth: [] }, { apiKey: [] }],
});

export function registerDesignsRoutes(app: OpenAPIHono<AppBindings>) {
  app.openapi(uploadDesignRoute, async (c) => {
    const input = c.req.valid("json");

    if (input.listingId) {
      const listingActive = await prisma.productListing.findUnique({
        where: { id: input.listingId },
        select: { active: true },
      } as never);

      if (!listingActive?.active) {
        return c.json(
          {
            error: {
              code: "INVALID_LISTING",
              message: "listingId must reference an active listing",
            },
          } as never,
          400,
        );
      }
    }

    const fileKey = createFileKey(input.fileName);
    const createData: Record<string, unknown> = {
      uploaderId: input.uploaderId,
      fileKey,
      fileType: input.fileType,
      drmEnabled: input.drmEnabled,
    };

    if (input.listingId) {
      createData.listing = { connect: { id: input.listingId } };
    }

    const designFile = await prisma.designFile.create({ data: createData as never } as never);
    const upload = await createUploadUrl({
      designId: designFile.id,
      fileKey,
      fileName: input.fileName,
      fileType: input.fileType,
    });
    const response: DesignUploadResponse = {
      ...designFileToResponse(designFile),
      uploadUrl: upload.uploadUrl,
      storageProvider: upload.storageProvider,
    };

    return c.json(response as never, 202);
  });

  // Non-OpenAPI route for completing local uploads
  app.put("/designs/upload/:id/complete", async (c) => {
    const { id } = c.req.param();
    const designFile = await prisma.designFile.findUnique({ where: { id } });

    if (!designFile) {
      return c.json({ error: { code: "NOT_FOUND", message: "Design upload not found" } }, 404);
    }

    const body = await c.req.arrayBuffer();
    const uploadDir = getLocalUploadDir();
    await mkdir(uploadDir, { recursive: true });
    await writeFile(path.join(uploadDir, designFile.fileKey), Buffer.from(body));

    return c.json({
      ok: true,
      storageProvider: "local",
      design: designFileToResponse(designFile),
    } as never);
  });

  app.openapi(getDesignRoute, async (c) => {
    const { id } = c.req.valid("param");
    const designFile = await prisma.designFile.findUnique({ where: { id } });

    if (!designFile) {
      return c.json({ error: { code: "NOT_FOUND", message: "Design not found" } }, 404);
    }

    if (designFile.drmEnabled) {
      const accessError = requireDesignAccess(c);
      if (accessError) return accessError as never;
    }

    return c.json(designFileToResponse(designFile) as never);
  });

  app.openapi(getDesignRoyaltiesRoute, async (c) => {
    const { id } = c.req.valid("param");
    const design = await prisma.designFile.findUnique({ where: { id } });
    if (!design)
      return c.json({ code: "NOT_FOUND", message: "Design not found" }, 404) as never;
    const royalties = await prisma.designRoyalty.findMany({
      where: { designFileId: id },
      orderBy: { createdAt: "desc" },
    });
    return c.json(
      royalties.map((r) => {
        const paidAt = (r as unknown as { paidAt: Date | null }).paidAt;
        return {
          id: r.id,
          designFileId: r.designFileId,
          orderId: r.orderId,
          recipientId: r.recipientId,
          amount: r.amount,
          credits: r.credits,
          ...(paidAt ? { paidAt: paidAt.toISOString() } : {}),
          createdAt: r.createdAt.toISOString(),
        };
      }) as never,
    );
  });
}

