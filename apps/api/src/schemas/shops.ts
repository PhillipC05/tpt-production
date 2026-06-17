import { z } from "@hono/zod-openapi";

export const shopCapabilitySchema = z.object({
  id: z.string().optional(),
  shopId: z.string().optional(),
  material: z.string().trim().min(1).max(80),
  machineType: z.string().trim().min(1).max(80),
  category: z.string().trim().min(1).max(80),
  createdAt: z.string().datetime().optional(),
});

export const makerShopSchema = z.object({
  id: z.string(),
  userId: z.string(),
  name: z.string(),
  locationLat: z.number(),
  locationLng: z.number(),
  active: z.boolean(),
  capacity: z.number().int(),
  capabilities: z.array(shopCapabilitySchema).optional(),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
});

export const onboardShopSchema = z.object({
  email: z.string().trim().email().max(255),
  name: z.string().trim().min(1).max(120),
  locationLat: z.number().finite().min(-90).max(90),
  locationLng: z.number().finite().min(-180).max(180),
  capacity: z.number().int().nonnegative().default(0),
});

export const updateShopSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  locationLat: z.number().finite().min(-90).max(90).optional(),
  locationLng: z.number().finite().min(-180).max(180).optional(),
  active: z.boolean().optional(),
  capacity: z.number().int().nonnegative().optional(),
});

export const shopCapacityResponseSchema = z.object({
  shopId: z.string(),
  capacity: z.number().int(),
  active: z.boolean(),
});

export const addCapabilitiesSchema = z.object({
  capabilities: z
    .array(
      z.object({
        material: z.string().trim().min(1).max(80),
        machineType: z.string().trim().min(1).max(80),
        category: z.string().trim().min(1).max(80),
      }),
    )
    .min(1)
    .max(50),
});

export const reportCapacityBodySchema = z.object({
  capacity: z.number().int().nonnegative(),
});

export const heartbeatResponseSchema = z.object({
  ok: z.boolean(),
  shopId: z.string(),
  at: z.string().datetime(),
});

export const supplierSchema = z.object({
  id: z.string(),
  name: z.string(),
  apiConfig: z.record(z.unknown()),
  active: z.boolean(),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
});

export const createSupplierSchema = z.object({
  name: z.string().trim().min(1).max(120),
  apiConfig: z.record(z.unknown()),
  active: z.boolean().default(true),
});
