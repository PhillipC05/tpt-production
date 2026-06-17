import { createRoute } from "@hono/zod-openapi";
import type { OpenAPIHono } from "@hono/zod-openapi";
import type { CreateProductListingInput, UpdateProductListingInput } from "@tpt/types";
import { prisma } from "../lib/prisma";
import { requireAdmin } from "../lib/auth";
import { listingToResponse } from "../lib/mappers";
import type { AppBindings } from "../types/hono";
import { idParamSchema } from "../schemas/common";
import {
  productListingSchema,
  catalogListSchema,
  createProductListingSchema,
  updateProductListingSchema,
  catalogQuerySchema,
} from "../schemas/catalog";

const listCatalogRoute = createRoute({
  method: "get",
  path: "/catalog",
  request: { query: catalogQuerySchema },
  responses: {
    200: {
      description: "Paginated active product listings",
      content: { "application/json": { schema: catalogListSchema } },
    },
  },
});

const getCatalogRoute = createRoute({
  method: "get",
  path: "/catalog/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "Product listing with design files",
      content: { "application/json": { schema: productListingSchema } },
    },
    404: { description: "Listing not found" },
  },
});

const createCatalogRoute = createRoute({
  method: "post",
  path: "/catalog",
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: createProductListingSchema } },
    },
  },
  responses: {
    201: {
      description: "Created product listing",
      content: { "application/json": { schema: productListingSchema } },
    },
    401: { description: "Admin token required" },
  },
  security: [{ bearerAuth: [] }, { apiKey: [] }],
});

const updateCatalogRoute = createRoute({
  method: "put",
  path: "/catalog/{id}",
  request: {
    params: idParamSchema,
    body: {
      required: true,
      content: { "application/json": { schema: updateProductListingSchema } },
    },
  },
  responses: {
    200: {
      description: "Updated product listing",
      content: { "application/json": { schema: productListingSchema } },
    },
    401: { description: "Admin token required" },
    404: { description: "Listing not found" },
  },
  security: [{ bearerAuth: [] }, { apiKey: [] }],
});

const deleteCatalogRoute = createRoute({
  method: "delete",
  path: "/catalog/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "Deactivated product listing",
      content: { "application/json": { schema: productListingSchema } },
    },
    401: { description: "Admin token required" },
    404: { description: "Listing not found" },
  },
  security: [{ bearerAuth: [] }, { apiKey: [] }],
});

export function registerCatalogRoutes(app: OpenAPIHono<AppBindings>) {
  app.openapi(listCatalogRoute, async (c) => {
    const query = c.req.valid("query");
    const where: Record<string, unknown> = { active: true };

    if (query.sourceType) where.sourceType = query.sourceType;
    if (query.category) where.category = { contains: query.category };
    if (query.search) {
      where.OR = [
        { title: { contains: query.search } },
        { description: { contains: query.search } },
        { category: { contains: query.search } },
      ];
    }
    if (query.priceMin !== undefined || query.priceMax !== undefined) {
      where.price = {
        ...(query.priceMin !== undefined ? { gte: query.priceMin } : {}),
        ...(query.priceMax !== undefined ? { lte: query.priceMax } : {}),
      };
    }

    const [listings, total] = await prisma.$transaction([
      prisma.productListing.findMany({
        where,
        include: { designFiles: { orderBy: { createdAt: "desc" } } },
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      prisma.productListing.count({ where }),
    ]);

    return c.json(
      {
        data: listings.map(listingToResponse),
        meta: {
          page: query.page,
          pageSize: query.pageSize,
          total,
          totalPages: Math.ceil(total / query.pageSize),
        },
      } as never,
    );
  });

  app.openapi(getCatalogRoute, async (c) => {
    const { id } = c.req.valid("param");
    const listing = await prisma.productListing.findUnique({
      where: { id },
      include: {
        designFiles: { orderBy: { createdAt: "desc" } },
        pricingRules: true,
      },
    });

    if (!listing || !listing.active) {
      return c.json({ error: { code: "NOT_FOUND", message: "Listing not found" } }, 404);
    }

    return c.json(listingToResponse(listing) as never);
  });

  app.openapi(createCatalogRoute, async (c) => {
    const adminError = requireAdmin(c);
    if (adminError) return adminError as never;

    const input = c.req.valid("json") as CreateProductListingInput;
    const createData: Record<string, unknown> = {
      title: input.title,
      description: input.description,
      sourceType: input.sourceType,
      price: input.price,
      currency: input.currency ?? "NZD",
      active: input.active ?? true,
    };
    if (input.category !== undefined) createData.category = input.category;

    const listing = await prisma.productListing.create({
      data: createData as never,
      include: { designFiles: true },
    } as never);

    if (input.designFileIds && input.designFileIds.length > 0) {
      await prisma.designFile.updateMany({
        where: { id: { in: input.designFileIds } },
        data: { listingId: listing.id },
      });
    }

    const enrichedListing = await prisma.productListing.findUnique({
      where: { id: listing.id },
      include: {
        designFiles: { orderBy: { createdAt: "desc" } },
        pricingRules: true,
      },
    });

    if (!enrichedListing) {
      return c.json({ error: { code: "NOT_FOUND", message: "Listing not found" } } as never, 404);
    }

    return c.json(listingToResponse(enrichedListing) as never, 201);
  });

  app.openapi(updateCatalogRoute, async (c) => {
    const adminError = requireAdmin(c);
    if (adminError) return adminError as never;

    const { id } = c.req.valid("param");
    const input = c.req.valid("json") as UpdateProductListingInput;
    const existing = await prisma.productListing.findUnique({ where: { id } });

    if (!existing) {
      return c.json({ error: { code: "NOT_FOUND", message: "Listing not found" } }, 404);
    }

    const updateData: Record<string, unknown> = {};
    if (input.title !== undefined) updateData.title = input.title;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.category !== undefined) updateData.category = input.category;
    if (input.sourceType !== undefined) updateData.sourceType = input.sourceType;
    if (input.price !== undefined) updateData.price = input.price;
    if (input.currency !== undefined) updateData.currency = input.currency;
    if (input.active !== undefined) updateData.active = input.active;

    await prisma.productListing.update({
      where: { id },
      data: updateData as never,
    } as never);

    if (input.designFileIds !== undefined) {
      await prisma.$transaction([
        prisma.designFile.updateMany({
          where: { listingId: id },
          data: { listingId: null },
        }),
        ...(input.designFileIds.length > 0
          ? [
              prisma.designFile.updateMany({
                where: { id: { in: input.designFileIds } },
                data: { listingId: id },
              }),
            ]
          : []),
      ]);
    }

    const enrichedListing = await prisma.productListing.findUnique({
      where: { id },
      include: {
        designFiles: { orderBy: { createdAt: "desc" } },
        pricingRules: true,
      },
    });

    if (!enrichedListing) {
      return c.json({ error: { code: "NOT_FOUND", message: "Listing not found" } } as never, 404);
    }

    return c.json(listingToResponse(enrichedListing) as never);
  });

  app.openapi(deleteCatalogRoute, async (c) => {
    const adminError = requireAdmin(c);
    if (adminError) return adminError as never;

    const { id } = c.req.valid("param");
    const listing = await prisma.productListing.update({
      where: { id },
      data: { active: false },
      include: {
        designFiles: { orderBy: { createdAt: "desc" } },
        pricingRules: true,
      },
    });

    return c.json(listingToResponse(listing) as never);
  });
}
