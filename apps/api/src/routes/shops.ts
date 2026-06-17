import { createRoute } from "@hono/zod-openapi";
import type { OpenAPIHono } from "@hono/zod-openapi";
import type { AddCapabilitiesInput, OnboardShopInput, UpdateShopInput, CreateSupplierInput } from "@tpt/types";
import { prisma } from "../lib/prisma";
import { requireAdmin, resolveApiKey, apiKeyHasScope } from "../lib/auth";
import { shopToResponse, supplierToResponse } from "../lib/mappers";
import { ensureCreditAccount } from "../lib/credits";
import type { AppBindings } from "../types/hono";
import { idParamSchema } from "../schemas/common";
import {
  makerShopSchema,
  onboardShopSchema,
  updateShopSchema,
  addCapabilitiesSchema,
  shopCapacityResponseSchema,
  heartbeatResponseSchema,
  reportCapacityBodySchema,
  supplierSchema,
  createSupplierSchema,
} from "../schemas/shops";

const onboardShopRoute = createRoute({
  method: "post",
  path: "/shops/onboard",
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: onboardShopSchema } },
    },
  },
  responses: {
    201: {
      description: "Shop created",
      content: { "application/json": { schema: makerShopSchema } },
    },
    409: { description: "User already has a shop" },
  },
});

const updateShopRoute = createRoute({
  method: "put",
  path: "/shops/{id}",
  request: {
    params: idParamSchema,
    body: {
      required: true,
      content: { "application/json": { schema: updateShopSchema } },
    },
  },
  responses: {
    200: {
      description: "Updated shop",
      content: { "application/json": { schema: makerShopSchema } },
    },
    404: { description: "Shop not found" },
  },
  security: [{ bearerAuth: [] }, { apiKey: [] }],
});

const getShopRoute = createRoute({
  method: "get",
  path: "/shops/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "Shop details",
      content: { "application/json": { schema: makerShopSchema } },
    },
    404: { description: "Shop not found" },
  },
});

const getShopCapacityRoute = createRoute({
  method: "get",
  path: "/shops/{id}/capacity",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "Shop capacity",
      content: { "application/json": { schema: shopCapacityResponseSchema } },
    },
    404: { description: "Shop not found" },
  },
});

const addCapabilitiesRoute = createRoute({
  method: "post",
  path: "/shops/{id}/capabilities",
  request: {
    params: idParamSchema,
    body: {
      required: true,
      content: { "application/json": { schema: addCapabilitiesSchema } },
    },
  },
  responses: {
    200: {
      description: "Shop with updated capabilities",
      content: { "application/json": { schema: makerShopSchema } },
    },
    404: { description: "Shop not found" },
  },
  security: [{ bearerAuth: [] }, { apiKey: [] }],
});

const heartbeatRoute = createRoute({
  method: "post",
  path: "/shops/{id}/heartbeat",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "Heartbeat acknowledged",
      content: { "application/json": { schema: heartbeatResponseSchema } },
    },
    401: { description: "API key with shop:write scope required" },
    404: { description: "Shop not found" },
  },
  security: [{ apiKey: [] }],
});

const reportCapacityRoute = createRoute({
  method: "post",
  path: "/shops/{id}/capacity",
  request: {
    params: idParamSchema,
    body: {
      required: true,
      content: { "application/json": { schema: reportCapacityBodySchema } },
    },
  },
  responses: {
    200: {
      description: "Capacity updated",
      content: { "application/json": { schema: shopCapacityResponseSchema } },
    },
    401: { description: "API key with shop:write scope required" },
    404: { description: "Shop not found" },
  },
  security: [{ apiKey: [] }],
});

const createSupplierRoute = createRoute({
  method: "post",
  path: "/suppliers",
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: createSupplierSchema } },
    },
  },
  responses: {
    201: {
      description: "Created supplier",
      content: { "application/json": { schema: supplierSchema } },
    },
    401: { description: "Admin token required" },
  },
  security: [{ bearerAuth: [] }, { apiKey: [] }],
});

const listSuppliersRoute = createRoute({
  method: "get",
  path: "/suppliers",
  responses: {
    200: {
      description: "List of suppliers",
      content: { "application/json": { schema: supplierSchema.array() } },
    },
    401: { description: "Admin token required" },
  },
  security: [{ bearerAuth: [] }, { apiKey: [] }],
});

export function registerShopsRoutes(app: OpenAPIHono<AppBindings>) {
  app.openapi(onboardShopRoute, async (c) => {
    const input = c.req.valid("json") as OnboardShopInput;

    const existingUser = await prisma.user.findUnique({ where: { email: input.email } });
    const user =
      existingUser ??
      (await prisma.user.create({ data: { email: input.email, role: "MAKER" } }));

    if (user.role !== "MAKER" && user.role !== "ADMIN") {
      await prisma.user.update({ where: { id: user.id }, data: { role: "MAKER" } });
    }

    const existingShop = await prisma.makerShop.findUnique({ where: { userId: user.id } });
    if (existingShop) {
      return c.json(
        { error: { code: "SHOP_EXISTS", message: "User already has a shop" } } as never,
        409,
      );
    }

    const shop = await prisma.makerShop.create({
      data: {
        userId: user.id,
        name: input.name,
        locationLat: input.locationLat,
        locationLng: input.locationLng,
        capacity: input.capacity ?? 0,
      },
      include: { capabilities: true },
    });

    await ensureCreditAccount(user.id);

    return c.json(shopToResponse(shop) as never, 201);
  });

  app.openapi(updateShopRoute, async (c) => {
    const { id } = c.req.valid("param");
    const input = c.req.valid("json") as UpdateShopInput;
    const existing = await prisma.makerShop.findUnique({ where: { id } });

    if (!existing) {
      return c.json({ error: { code: "NOT_FOUND", message: "Shop not found" } }, 404);
    }

    const updateData: Record<string, unknown> = {};
    if (input.name !== undefined) updateData.name = input.name;
    if (input.locationLat !== undefined) updateData.locationLat = input.locationLat;
    if (input.locationLng !== undefined) updateData.locationLng = input.locationLng;
    if (input.active !== undefined) updateData.active = input.active;
    if (input.capacity !== undefined) updateData.capacity = input.capacity;

    const shop = await prisma.makerShop.update({
      where: { id },
      data: updateData as never,
      include: { capabilities: true },
    });

    return c.json(shopToResponse(shop) as never);
  });

  app.openapi(getShopRoute, async (c) => {
    const { id } = c.req.valid("param");
    const shop = await prisma.makerShop.findUnique({
      where: { id },
      include: { capabilities: true },
    });

    if (!shop) {
      return c.json({ error: { code: "NOT_FOUND", message: "Shop not found" } }, 404);
    }

    return c.json(shopToResponse(shop) as never);
  });

  app.openapi(getShopCapacityRoute, async (c) => {
    const { id } = c.req.valid("param");
    const shop = await prisma.makerShop.findUnique({
      where: { id },
      select: { id: true, capacity: true, active: true },
    });

    if (!shop) {
      return c.json({ error: { code: "NOT_FOUND", message: "Shop not found" } }, 404);
    }

    return c.json({ shopId: shop.id, capacity: shop.capacity, active: shop.active } as never);
  });

  app.openapi(addCapabilitiesRoute, async (c) => {
    const { id } = c.req.valid("param");
    const input = c.req.valid("json") as AddCapabilitiesInput;
    const existing = await prisma.makerShop.findUnique({ where: { id } });

    if (!existing) {
      return c.json({ error: { code: "NOT_FOUND", message: "Shop not found" } }, 404);
    }

    await prisma.$transaction(
      input.capabilities.map((cap) =>
        prisma.shopCapability.upsert({
          where: {
            shopId_material_machineType_category: {
              shopId: id,
              material: cap.material,
              machineType: cap.machineType,
              category: cap.category,
            },
          },
          create: { shopId: id, ...cap },
          update: {},
        }),
      ),
    );

    const shop = await prisma.makerShop.findUnique({
      where: { id },
      include: { capabilities: true },
    });

    return c.json(shopToResponse(shop!) as never);
  });

  app.openapi(heartbeatRoute, async (c) => {
    const xApiKey = c.req.header("x-api-key");
    if (!xApiKey) {
      return c.json({ error: { code: "UNAUTHORIZED", message: "API key required" } } as never, 401);
    }
    const record = await resolveApiKey(xApiKey);
    if (!record || !apiKeyHasScope(record, "shop:write")) {
      return c.json(
        { error: { code: "UNAUTHORIZED", message: "shop:write scope required" } } as never,
        401,
      );
    }

    const { id } = c.req.valid("param");
    const shop = await prisma.makerShop.findUnique({ where: { id }, select: { id: true } });
    if (!shop)
      return c.json({ error: { code: "NOT_FOUND", message: "Shop not found" } } as never, 404);

    return c.json({ ok: true, shopId: id, at: new Date().toISOString() } as never);
  });

  app.openapi(reportCapacityRoute, async (c) => {
    const xApiKey = c.req.header("x-api-key");
    if (!xApiKey) {
      return c.json({ error: { code: "UNAUTHORIZED", message: "API key required" } } as never, 401);
    }
    const record = await resolveApiKey(xApiKey);
    if (!record || !apiKeyHasScope(record, "shop:write")) {
      return c.json(
        { error: { code: "UNAUTHORIZED", message: "shop:write scope required" } } as never,
        401,
      );
    }

    const { id } = c.req.valid("param");
    const { capacity } = c.req.valid("json");
    const shop = await prisma.makerShop.findUnique({ where: { id } });
    if (!shop)
      return c.json({ error: { code: "NOT_FOUND", message: "Shop not found" } } as never, 404);

    const updated = await prisma.makerShop.update({
      where: { id },
      data: { capacity },
      select: { id: true, capacity: true, active: true },
    });
    return c.json({ shopId: updated.id, capacity: updated.capacity, active: updated.active } as never);
  });

  app.openapi(createSupplierRoute, async (c) => {
    const adminError = requireAdmin(c);
    if (adminError) return adminError as never;

    const input = c.req.valid("json") as CreateSupplierInput;
    const supplier = await prisma.supplier.create({
      data: {
        name: input.name,
        apiConfig: input.apiConfig as never,
        active: input.active ?? true,
      },
    });

    return c.json(supplierToResponse(supplier) as never, 201);
  });

  app.openapi(listSuppliersRoute, async (c) => {
    const adminError = requireAdmin(c);
    if (adminError) return adminError as never;

    const suppliers = await prisma.supplier.findMany({ orderBy: { createdAt: "desc" } });
    return c.json(suppliers.map(supplierToResponse) as never);
  });
}
