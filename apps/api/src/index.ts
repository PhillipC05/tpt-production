import { PrismaClient } from "@tpt/db";
import { SourceType } from "@tpt/types";
import type { JsonValue } from "@tpt/types";
import type {
  AddCapabilitiesInput,
  CreateCustomOrderRequestInput,
  CreateProductListingInput,
  CreateSupplierInput,
  CustomOrderRequest,
  DesignFile,
  DesignUploadResponse,
  MakerShop,
  OnboardShopInput,
  PricingRule,
  ProductListing,
  Supplier,
  UpdateProductListingInput,
  UpdateShopInput,
} from "@tpt/types";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { SwaggerUI } from "@hono/swagger-ui";
import { serve } from "@hono/node-server";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(packageRoot, "..");
const defaultDatabaseUrl = `file:${path.join(repoRoot, "packages/db/prisma/dev.db")}`;

process.env.DATABASE_URL = process.env.DATABASE_URL ?? defaultDatabaseUrl;

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "production" ? ["error"] : ["error", "warn"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

type AppBindings = {
  Variables: {
    requestId: string;
  };
};

type RequestContext = {
  req: {
    header: (name: string) => string | undefined;
  };
  get: (key: "requestId") => string;
  json: (body: unknown, status?: number) => Response;
};

type UploadResult = {
  uploadUrl: string;
  storageProvider: "local" | "r2";
};

type ListingResponseInput = {
  id: string;
  title: string;
  description: string;
  category: string | null;
  sourceType: SourceType;
  price: number;
  currency: string;
  active: boolean;
  designFiles: Array<{
    id: string;
    listingId: string | null;
    uploaderId: string;
    fileKey: string;
    fileType: string;
    drmEnabled: boolean;
    createdAt: Date;
    updatedAt: Date;
  }>;
  pricingRules?: Array<{
    id: string;
    listingId: string;
    type: "FIXED" | "COST_PLUS" | "FREE" | "DECAY";
    decaySchedule: unknown;
    createdAt: Date;
    updatedAt: Date;
  }>;
  createdAt: Date;
  updatedAt: Date;
};

type DesignFileResponseInput = {
  id: string;
  listingId: string | null;
  uploaderId: string;
  fileKey: string;
  fileType: string;
  drmEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type PricingRuleResponseInput = {
  id: string;
  listingId: string;
  type: "FIXED" | "COST_PLUS" | "FREE" | "DECAY";
  decaySchedule: unknown;
  createdAt: Date;
  updatedAt: Date;
};

type CustomOrderResponseInput = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  request: string;
  status: string;
  metadata: unknown;
  createdAt: Date;
  updatedAt: Date;
};

const sourceTypeValues = Object.values(SourceType) as [SourceType, ...SourceType[]];
const sourceTypeSchema = z.enum(sourceTypeValues);
const pricingRuleTypeSchema = z.enum(["FIXED", "COST_PLUS", "FREE", "DECAY"]);

const paginationMetaSchema = z.object({
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1).max(100),
  total: z.number().int().min(0),
  totalPages: z.number().int().min(0),
});

const designFileSchema = z.object({
  id: z.string(),
  listingId: z.string().optional(),
  uploaderId: z.string(),
  fileKey: z.string(),
  fileType: z.string(),
  drmEnabled: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

const pricingRuleSchema = z.object({
  id: z.string(),
  listingId: z.string(),
  type: pricingRuleTypeSchema,
  decaySchedule: z.unknown().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

const productListingSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  category: z.string().optional(),
  sourceType: sourceTypeSchema,
  price: z.number(),
  currency: z.string(),
  active: z.boolean(),
  designFiles: z.array(designFileSchema).optional(),
  pricingRules: z.array(pricingRuleSchema).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

const catalogListSchema = z.object({
  data: z.array(productListingSchema),
  meta: paginationMetaSchema,
});

const createProductListingSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(5000),
  category: z.string().trim().min(1).max(80).optional(),
  sourceType: sourceTypeSchema,
  price: z.number().finite().nonnegative(),
  currency: z.string().trim().min(3).max(3).default("NZD"),
  active: z.boolean().default(true),
  designFileIds: z.array(z.string().min(1)).max(20).optional(),
});

const updateProductListingSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().min(1).max(5000).optional(),
  category: z.string().trim().min(1).max(80).optional(),
  sourceType: sourceTypeSchema.optional(),
  price: z.number().finite().nonnegative().optional(),
  currency: z.string().trim().min(3).max(3).optional(),
  active: z.boolean().optional(),
  designFileIds: z.array(z.string().min(1)).max(20).optional(),
});

const designUploadSchema = z.object({
  listingId: z.string().min(1).optional(),
  uploaderId: z.string().min(1),
  fileName: z.string().trim().min(1).max(180),
  fileType: z.string().trim().min(1).max(120),
  drmEnabled: z.boolean().default(true),
});

const designUploadResponseSchema = designFileSchema.extend({
  uploadUrl: z.string().url(),
  storageProvider: z.enum(["local", "r2"]),
});

const customOrderRequestSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  request: z.string(),
  status: z.string(),
  metadata: z.record(z.unknown()).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

const createCustomOrderRequestSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  email: z.string().trim().email().max(255).optional(),
  phone: z.string().trim().min(3).max(40).optional(),
  request: z.string().trim().min(20).max(5000),
  metadata: z.record(z.unknown()).optional(),
});

const idParamSchema = z.object({
  id: z.string().min(1).openapi({
    param: { name: "id", in: "path" },
    example: "cm2...",
  }),
});

const shopCapabilitySchema = z.object({
  id: z.string().optional(),
  shopId: z.string().optional(),
  material: z.string().trim().min(1).max(80),
  machineType: z.string().trim().min(1).max(80),
  category: z.string().trim().min(1).max(80),
  createdAt: z.string().datetime().optional(),
});

const makerShopSchema = z.object({
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

const onboardShopSchema = z.object({
  email: z.string().trim().email().max(255),
  name: z.string().trim().min(1).max(120),
  locationLat: z.number().finite().min(-90).max(90),
  locationLng: z.number().finite().min(-180).max(180),
  capacity: z.number().int().nonnegative().default(0),
});

const updateShopSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  locationLat: z.number().finite().min(-90).max(90).optional(),
  locationLng: z.number().finite().min(-180).max(180).optional(),
  active: z.boolean().optional(),
  capacity: z.number().int().nonnegative().optional(),
});

const shopCapacityResponseSchema = z.object({
  shopId: z.string(),
  capacity: z.number().int(),
  active: z.boolean(),
});

const addCapabilitiesSchema = z.object({
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

const supplierSchema = z.object({
  id: z.string(),
  name: z.string(),
  apiConfig: z.record(z.unknown()),
  active: z.boolean(),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
});

const createSupplierSchema = z.object({
  name: z.string().trim().min(1).max(120),
  apiConfig: z.record(z.unknown()),
  active: z.boolean().default(true),
});

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
      content: { "application/json": { schema: z.array(supplierSchema) } },
    },
    401: { description: "Admin token required" },
  },
  security: [{ bearerAuth: [] }, { apiKey: [] }],
});

const catalogQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  sourceType: sourceTypeSchema.optional(),
  category: z.string().trim().min(1).optional(),
  priceMin: z.coerce.number().finite().nonnegative().optional(),
  priceMax: z.coerce.number().finite().nonnegative().optional(),
  search: z.string().trim().min(1).optional(),
});

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
      content: {
        "application/json": { schema: createProductListingSchema },
      },
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
      content: {
        "application/json": { schema: updateProductListingSchema },
      },
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

const uploadDesignRoute = createRoute({
  method: "post",
  path: "/designs/upload",
  request: {
    body: {
      required: true,
      content: {
        "application/json": { schema: designUploadSchema },
      },
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

const createCustomOrderRoute = createRoute({
  method: "post",
  path: "/orders/custom",
  request: {
    body: {
      required: true,
      content: {
        "application/json": { schema: createCustomOrderRequestSchema },
      },
    },
  },
  responses: {
    202: {
      description: "Custom order request submitted",
      content: { "application/json": { schema: customOrderRequestSchema } },
    },
  },
});

export const app = new OpenAPIHono<AppBindings>();

app.use("*", logger());
app.use(
  "*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "X-API-Key", "X-Request-ID"],
  }),
);
app.use("*", async (c, next) => {
  const requestId = c.req.header("x-request-id") ?? randomUUID();
  c.set("requestId", requestId);
  c.header("x-request-id", requestId);
  await next();
});

app.get("/", (c) =>
  c.json({
    name: "TPT Marketplace API",
    openapi: "/openapi.json",
    docs: "/docs",
  }),
);

app.get("/health", (c) => c.json({ ok: true }));

app.openapi(listCatalogRoute, async (c) => {
  const query = c.req.valid("query");
  const where: Record<string, unknown> = { active: true };

  if (query.sourceType) {
    where.sourceType = query.sourceType;
  }

  if (query.category) {
    where.category = { contains: query.category };
  }

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
    return c.json(
      { error: { code: "NOT_FOUND", message: "Listing not found" } },
      404,
    );
  }

  return c.json(listingToResponse(listing) as never);
});

app.openapi(createCatalogRoute, async (c) => {
  const adminError = requireAdmin(c);
  if (adminError) {
    return adminError;
  }

  const input = c.req.valid("json") as CreateProductListingInput;
  const createData: Record<string, unknown> = {
    title: input.title,
    description: input.description,
    sourceType: input.sourceType,
    price: input.price,
    currency: input.currency ?? "NZD",
    active: input.active ?? true,
  };

  setIfDefined(createData, "category", input.category);

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
    return c.json(
      { error: { code: "NOT_FOUND", message: "Listing not found" } } as never,
      404,
    );
  }

  return c.json(listingToResponse(enrichedListing) as never, 201);
});

app.openapi(updateCatalogRoute, async (c) => {
  const adminError = requireAdmin(c);
  if (adminError) {
    return adminError;
  }

  const { id } = c.req.valid("param");
  const input = c.req.valid("json") as UpdateProductListingInput;
  const existing = await prisma.productListing.findUnique({ where: { id } });

  if (!existing) {
    return c.json(
      { error: { code: "NOT_FOUND", message: "Listing not found" } },
      404,
    );
  }

  const updateData: Record<string, unknown> = {};
  setIfDefined(updateData, "title", input.title);
  setIfDefined(updateData, "description", input.description);
  setIfDefined(updateData, "category", input.category);
  setIfDefined(updateData, "sourceType", input.sourceType);
  setIfDefined(updateData, "price", input.price);
  setIfDefined(updateData, "currency", input.currency);
  setIfDefined(updateData, "active", input.active);

  const listing = await prisma.productListing.update({
    where: { id },
    data: updateData as never,
    include: {
      designFiles: { orderBy: { createdAt: "desc" } },
      pricingRules: true,
    },
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
    return c.json(
      { error: { code: "NOT_FOUND", message: "Listing not found" } } as never,
      404,
    );
  }

  return c.json(listingToResponse(enrichedListing) as never);
});

app.openapi(deleteCatalogRoute, async (c) => {
  const adminError = requireAdmin(c);
  if (adminError) {
    return adminError;
  }

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

app.put("/designs/upload/:id/complete", async (c) => {
  const { id } = c.req.param();
  const designFile = await prisma.designFile.findUnique({ where: { id } });

  if (!designFile) {
    return c.json(
      { error: { code: "NOT_FOUND", message: "Design upload not found" } },
      404,
    );
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
    return c.json(
      { error: { code: "NOT_FOUND", message: "Design not found" } },
      404,
    );
  }

  if (designFile.drmEnabled) {
    const accessError = requireDesignAccess(c);
    if (accessError) {
      return accessError;
    }
  }

  return c.json(designFileToResponse(designFile) as never);
});

app.openapi(createCustomOrderRoute, async (c) => {
  const input = c.req.valid("json") as CreateCustomOrderRequestInput;
  const createData: Record<string, unknown> = {
    request: input.request,
  };

  setIfDefined(createData, "name", input.name);
  setIfDefined(createData, "email", input.email);
  setIfDefined(createData, "phone", input.phone);
  setIfDefined(createData, "metadata", input.metadata as JsonValue | undefined);

  const customOrderRequest = await prisma.customOrderRequest.create({
    data: createData as never,
  } as never);

  return c.json(customOrderRequestToResponse(customOrderRequest) as never, 202);
});

app.openapi(onboardShopRoute, async (c) => {
  const input = c.req.valid("json") as OnboardShopInput;

  const existingUser = await prisma.user.findUnique({ where: { email: input.email } });
  const user =
    existingUser ??
    (await prisma.user.create({
      data: { email: input.email, role: "MAKER" },
    }));

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

  return c.json(shopToResponse(shop) as never, 201);
});

app.openapi(updateShopRoute, async (c) => {
  const { id } = c.req.valid("param");
  const input = c.req.valid("json") as UpdateShopInput;
  const existing = await prisma.makerShop.findUnique({ where: { id } });

  if (!existing) {
    return c.json(
      { error: { code: "NOT_FOUND", message: "Shop not found" } },
      404,
    );
  }

  const updateData: Record<string, unknown> = {};
  setIfDefined(updateData, "name", input.name);
  setIfDefined(updateData, "locationLat", input.locationLat);
  setIfDefined(updateData, "locationLng", input.locationLng);
  setIfDefined(updateData, "active", input.active);
  setIfDefined(updateData, "capacity", input.capacity);

  const shop = await prisma.makerShop.update({
    where: { id },
    data: updateData as never,
    include: { capabilities: true },
  });

  return c.json(shopToResponse(shop) as never);
});

app.openapi(getShopCapacityRoute, async (c) => {
  const { id } = c.req.valid("param");
  const shop = await prisma.makerShop.findUnique({
    where: { id },
    select: { id: true, capacity: true, active: true },
  });

  if (!shop) {
    return c.json(
      { error: { code: "NOT_FOUND", message: "Shop not found" } },
      404,
    );
  }

  return c.json({ shopId: shop.id, capacity: shop.capacity, active: shop.active } as never);
});

app.openapi(addCapabilitiesRoute, async (c) => {
  const { id } = c.req.valid("param");
  const input = c.req.valid("json") as AddCapabilitiesInput;
  const existing = await prisma.makerShop.findUnique({ where: { id } });

  if (!existing) {
    return c.json(
      { error: { code: "NOT_FOUND", message: "Shop not found" } },
      404,
    );
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

app.openapi(createSupplierRoute, async (c) => {
  const adminError = requireAdmin(c);
  if (adminError) return adminError;

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
  if (adminError) return adminError;

  const suppliers = await prisma.supplier.findMany({ orderBy: { createdAt: "desc" } });
  return c.json(suppliers.map(supplierToResponse) as never);
});

app.doc31(
  "/openapi.json",
  {
    openapi: "3.1.0",
    info: {
      title: "TPT Marketplace API",
      version: "1.0.0",
      description: "Catalog, design upload, and custom order endpoints.",
    },
    servers: [{ url: "/" }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "opaque",
        },
        apiKey: {
          type: "apiKey",
          in: "header",
          name: "X-API-Key",
        },
      },
    },
  } as never,
);

app.get("/docs", (c) =>
  c.html(SwaggerUI({ url: "/openapi.json", title: "TPT Marketplace API" })),
);

app.notFound((c) =>
  c.json(
    {
      error: {
        code: "NOT_FOUND",
        message: `Route ${c.req.method} ${c.req.path} was not found`,
        details: { requestId: c.get("requestId") },
      },
    },
    404,
  ),
);

app.onError((err, c) => {
  const details = { requestId: c.get("requestId") };

  if (isPrismaKnownRequestError(err)) {
    const status = prismaStatus(err.code);
    return c.json(
      {
        error: {
          code: err.code,
          message: err.message,
          details: { ...details, meta: err.meta },
        },
      },
      status,
    );
  }

  return c.json(
    {
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Internal server error",
        details,
      },
    },
    500,
  );
});

function listingToResponse(listing: ListingResponseInput): ProductListing {
  const response: ProductListing = {
    id: listing.id,
    title: listing.title,
    description: listing.description,
    sourceType: listing.sourceType,
    price: listing.price,
    currency: listing.currency,
    active: listing.active,
    createdAt: listing.createdAt.toISOString(),
    updatedAt: listing.updatedAt.toISOString(),
  };

  setIfDefined(response, "category", listing.category ?? undefined);
  setIfDefined(response, "designFiles", listing.designFiles.map(designFileToResponse));
  setIfDefined(
    response,
    "pricingRules",
    listing.pricingRules?.map(pricingRuleToResponse),
  );

  return response;
}

function designFileToResponse(designFile: DesignFileResponseInput): DesignFile {
  const response: DesignFile = {
    id: designFile.id,
    uploaderId: designFile.uploaderId,
    fileKey: designFile.fileKey,
    fileType: designFile.fileType,
    drmEnabled: designFile.drmEnabled,
    createdAt: designFile.createdAt.toISOString(),
    updatedAt: designFile.updatedAt.toISOString(),
  };

  setIfDefined(response, "listingId", designFile.listingId ?? undefined);

  return response;
}

function pricingRuleToResponse(
  pricingRule: PricingRuleResponseInput,
): PricingRule {
  const response: PricingRule = {
    id: pricingRule.id,
    listingId: pricingRule.listingId,
    type: pricingRule.type,
    createdAt: pricingRule.createdAt.toISOString(),
    updatedAt: pricingRule.updatedAt.toISOString(),
  };

  setIfDefined(
    response,
    "decaySchedule",
    pricingRule.decaySchedule as PricingRule["decaySchedule"] | undefined,
  );

  return response;
}

function customOrderRequestToResponse(
  customOrderRequest: CustomOrderResponseInput,
): CustomOrderRequest {
  const response: CustomOrderRequest = {
    id: customOrderRequest.id,
    request: customOrderRequest.request,
    status: customOrderRequest.status,
    createdAt: customOrderRequest.createdAt.toISOString(),
    updatedAt: customOrderRequest.updatedAt.toISOString(),
  };

  setIfDefined(response, "name", customOrderRequest.name ?? undefined);
  setIfDefined(response, "email", customOrderRequest.email ?? undefined);
  setIfDefined(response, "phone", customOrderRequest.phone ?? undefined);
  setIfDefined(
    response,
    "metadata",
    customOrderRequest.metadata === null
      ? undefined
      : (customOrderRequest.metadata as CustomOrderRequest["metadata"]),
  );

  return response;
}

type ShopResponseInput = {
  id: string;
  userId: string;
  name: string;
  locationLat: number;
  locationLng: number;
  active: boolean;
  capacity: number;
  capabilities?: Array<{
    id: string;
    shopId: string;
    material: string;
    machineType: string;
    category: string;
    createdAt: Date;
  }>;
  createdAt?: Date;
  updatedAt?: Date;
};

type SupplierResponseInput = {
  id: string;
  name: string;
  apiConfig: unknown;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
};

function shopToResponse(shop: ShopResponseInput): MakerShop {
  const response: MakerShop = {
    id: shop.id,
    userId: shop.userId,
    name: shop.name,
    locationLat: shop.locationLat,
    locationLng: shop.locationLng,
    active: shop.active,
    capacity: shop.capacity,
  };

  if (shop.capabilities) {
    response.capabilities = shop.capabilities.map((cap) => ({
      id: cap.id,
      shopId: cap.shopId,
      material: cap.material,
      machineType: cap.machineType,
      category: cap.category,
      createdAt: cap.createdAt.toISOString(),
    }));
  }

  if (shop.createdAt) response.createdAt = shop.createdAt.toISOString();
  if (shop.updatedAt) response.updatedAt = shop.updatedAt.toISOString();

  return response;
}

function supplierToResponse(supplier: SupplierResponseInput): Supplier {
  return {
    id: supplier.id,
    name: supplier.name,
    apiConfig: supplier.apiConfig as Supplier["apiConfig"],
    active: supplier.active,
    createdAt: supplier.createdAt.toISOString(),
    updatedAt: supplier.updatedAt.toISOString(),
  };
}

function requireAdmin(c: RequestContext): Response | null {
  const token = getAuthToken(c);
  const configuredToken = process.env.ADMIN_API_TOKEN;

  if (!configuredToken) {
    if (process.env.NODE_ENV === "production") {
      return jsonError(c, "ADMIN_TOKEN_NOT_CONFIGURED", 401);
    }
    return null;
  }

  if (!token || !safeEqual(token, configuredToken)) {
    return jsonError(c, "ADMIN_UNAUTHORIZED", 401);
  }

  return null;
}

function requireDesignAccess(c: RequestContext): Response | null {
  const token = getAuthToken(c);
  const configuredToken = process.env.ADMIN_API_TOKEN;

  if (!configuredToken) {
    if (process.env.NODE_ENV === "production") {
      return jsonError(c, "DRM_ACCESS_TOKEN_NOT_CONFIGURED", 403);
    }
    return null;
  }

  if (!token || !safeEqual(token, configuredToken)) {
    return jsonError(c, "DRM_UNAUTHORIZED", 403);
  }

  return null;
}

function getAuthToken(c: RequestContext) {
  const authorization = c.req.header("authorization");
  if (authorization?.toLowerCase().startsWith("bearer ")) {
    return authorization.slice("Bearer ".length);
  }
  return c.req.header("x-api-key");
}

function jsonError(
  c: RequestContext,
  code: string,
  status: number,
  message = code.replace(/_/g, " ").toLowerCase(),
) {
  return c.json(
    {
      error: {
        code,
        message,
        details: { requestId: c.get("requestId") },
      },
    },
    status,
  );
}

function setIfDefined<T extends object, K extends keyof T>(
  target: T,
  key: K,
  value: T[K] | undefined,
) {
  if (value !== undefined) {
    target[key] = value;
  }
}

function isPrismaKnownRequestError(
  err: unknown,
): err is { code: string; message: string; meta?: unknown } {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    typeof (err as { code?: unknown }).code === "string" &&
    "message" in err &&
    typeof (err as { message?: unknown }).message === "string"
  );
}

function safeEqual(left: string, right: string) {
  if (left.length !== right.length) {
    return false;
  }

  let diff = 0;
  for (let index = 0; index < left.length; index += 1) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }

  return diff === 0;
}

function createFileKey(fileName: string) {
  const safeName = fileName.replace(/[^a-z0-9._-]/gi, "_").slice(0, 120);
  return `designs/${randomUUID()}-${safeName}`;
}

async function createUploadUrl(input: {
  designId: string;
  fileKey: string;
  fileName: string;
  fileType: string;
}): Promise<UploadResult> {
  const r2 = getR2Config();

  if (r2) {
    const client = new S3Client({
      region: "auto",
      endpoint: r2.endpoint,
      credentials: {
        accessKeyId: r2.accessKeyId,
        secretAccessKey: r2.secretAccessKey,
      },
      forcePathStyle: true,
    });
    const command = new PutObjectCommand({
      Bucket: r2.bucketName,
      Key: input.fileKey,
      ContentType: input.fileType,
      Metadata: {
        design_id: input.designId,
        file_name: input.fileName,
      },
    });
    const uploadUrl = await getSignedUrl(client, command, { expiresIn: 3600 });
    return { uploadUrl, storageProvider: "r2" };
  }

  const baseUrl = (
    process.env.LOCAL_UPLOAD_BASE_URL ?? `http://localhost:${getPort()}`
  ).replace(/\/$/, "");

  return {
    uploadUrl: `${baseUrl}/designs/upload/${input.designId}/complete`,
    storageProvider: "local",
  };
}

function getR2Config() {
  const endpoint = process.env.R2_ENDPOINT;
  const bucketName = process.env.R2_BUCKET_NAME;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!endpoint || !bucketName || !accessKeyId || !secretAccessKey) {
    return null;
  }

  return { endpoint, bucketName, accessKeyId, secretAccessKey };
}

function getLocalUploadDir() {
  const configured = process.env.LOCAL_UPLOAD_DIR;
  return configured
    ? path.resolve(repoRoot, configured)
    : path.join(repoRoot, "apps/api/uploads");
}

function getPort() {
  const configured = Number(process.env.PORT ?? 8787);
  return Number.isFinite(configured) && configured > 0 ? configured : 8787;
}

function prismaStatus(code: string) {
  if (code === "P2025") {
    return 404;
  }
  if (code === "P2002") {
    return 409;
  }
  if (code === "P2003") {
    return 400;
  }
  return 500;
}

const shouldServe =
  process.env.NODE_ENV !== "test" &&
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (shouldServe) {
  const port = getPort();
  serve(
    {
      fetch: app.fetch,
      port,
      hostname: "0.0.0.0",
    },
    (info) => {
      console.log(`TPT API listening on http://localhost:${info.port}`);
      console.log(`OpenAPI: http://localhost:${info.port}/openapi.json`);
      console.log(`Docs: http://localhost:${info.port}/docs`);
    },
  );
}