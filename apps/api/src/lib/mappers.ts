import type {
  CustomOrderRequest,
  DesignFile,
  MakerShop,
  OrderResponse,
  PricingRule,
  ProductListing,
  Supplier,
  TrackingEvent,
} from "@tpt/types";

export type ListingResponseInput = {
  id: string;
  title: string;
  description: string;
  category: string | null;
  sourceType: ProductListing["sourceType"];
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

export type DesignFileResponseInput = {
  id: string;
  listingId: string | null;
  uploaderId: string;
  fileKey: string;
  fileType: string;
  drmEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type PricingRuleResponseInput = {
  id: string;
  listingId: string;
  type: "FIXED" | "COST_PLUS" | "FREE" | "DECAY";
  decaySchedule: unknown;
  createdAt: Date;
  updatedAt: Date;
};

export type CustomOrderResponseInput = {
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

export type ShopResponseInput = {
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

export type SupplierResponseInput = {
  id: string;
  name: string;
  apiConfig: unknown;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type FulfillmentJobResponse = {
  id: string;
  orderId: string;
  shopId?: string;
  supplierId?: string;
  status: string;
  acceptedAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type RoutingDecisionResponse = {
  id: string;
  orderId: string;
  shopId?: string;
  geoScore: number;
  costScore: number;
  capacityScore: number;
  capabilityScore: number;
  totalScore: number;
  chosen: boolean;
  createdAt: string;
};

export type PaymentResponse = {
  id: string;
  orderId: string;
  stripeCheckoutSessionId?: string;
  stripePaymentIntentId?: string;
  status: "PENDING" | "SUCCEEDED" | "FAILED" | "REFUNDED";
  amount: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
};

export type WebhookResponse = {
  id: string;
  url: string;
  events: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export function listingToResponse(listing: ListingResponseInput): ProductListing {
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

  if (listing.category !== null) response.category = listing.category;
  if (listing.designFiles) response.designFiles = listing.designFiles.map(designFileToResponse);
  if (listing.pricingRules) response.pricingRules = listing.pricingRules.map(pricingRuleToResponse);

  return response;
}

export function designFileToResponse(designFile: DesignFileResponseInput): DesignFile {
  const response: DesignFile = {
    id: designFile.id,
    uploaderId: designFile.uploaderId,
    fileKey: designFile.fileKey,
    fileType: designFile.fileType,
    drmEnabled: designFile.drmEnabled,
    createdAt: designFile.createdAt.toISOString(),
    updatedAt: designFile.updatedAt.toISOString(),
  };

  if (designFile.listingId !== null) response.listingId = designFile.listingId;

  return response;
}

export function pricingRuleToResponse(pricingRule: PricingRuleResponseInput): PricingRule {
  const response: PricingRule = {
    id: pricingRule.id,
    listingId: pricingRule.listingId,
    type: pricingRule.type,
    createdAt: pricingRule.createdAt.toISOString(),
    updatedAt: pricingRule.updatedAt.toISOString(),
  };

  const decaySchedule = pricingRule.decaySchedule as PricingRule["decaySchedule"] | undefined;
  if (decaySchedule !== undefined) {
    response.decaySchedule = decaySchedule;
  }

  return response;
}

export function customOrderRequestToResponse(
  customOrderRequest: CustomOrderResponseInput,
): CustomOrderRequest {
  const response: CustomOrderRequest = {
    id: customOrderRequest.id,
    request: customOrderRequest.request,
    status: customOrderRequest.status,
    createdAt: customOrderRequest.createdAt.toISOString(),
    updatedAt: customOrderRequest.updatedAt.toISOString(),
  };

  if (customOrderRequest.name !== null) response.name = customOrderRequest.name;
  if (customOrderRequest.email !== null) response.email = customOrderRequest.email;
  if (customOrderRequest.phone !== null) response.phone = customOrderRequest.phone;
  const metadata = customOrderRequest.metadata as CustomOrderRequest["metadata"] | undefined;
  if (metadata !== null && metadata !== undefined) {
    response.metadata = metadata;
  }

  return response;
}

export function shopToResponse(shop: ShopResponseInput): MakerShop {
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

export function supplierToResponse(supplier: SupplierResponseInput): Supplier {
  return {
    id: supplier.id,
    name: supplier.name,
    apiConfig: supplier.apiConfig as Supplier["apiConfig"],
    active: supplier.active,
    createdAt: supplier.createdAt.toISOString(),
    updatedAt: supplier.updatedAt.toISOString(),
  };
}

export function mapOrder(o: {
  id: string;
  userId: string;
  status: string;
  items: Array<{
    id: string;
    orderId: string;
    listingId: string | null;
    designFileId: string | null;
    quantity: number;
    unitPrice: number;
    createdAt: Date;
    updatedAt: Date;
  }>;
  createdAt: Date;
  updatedAt: Date;
}): OrderResponse {
  return {
    id: o.id,
    userId: o.userId,
    status: o.status as OrderResponse["status"],
    items: o.items.map((i) => ({
      id: i.id,
      orderId: i.orderId,
      ...(i.listingId ? { listingId: i.listingId } : {}),
      ...(i.designFileId ? { designFileId: i.designFileId } : {}),
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      createdAt: i.createdAt.toISOString(),
      updatedAt: i.updatedAt.toISOString(),
    })),
    createdAt: o.createdAt.toISOString(),
    updatedAt: o.updatedAt.toISOString(),
  };
}

export function mapJob(j: {
  id: string;
  orderId: string;
  shopId: string | null;
  supplierId: string | null;
  status: string;
  acceptedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): FulfillmentJobResponse {
  return {
    id: j.id,
    orderId: j.orderId,
    ...(j.shopId ? { shopId: j.shopId } : {}),
    ...(j.supplierId ? { supplierId: j.supplierId } : {}),
    status: j.status,
    ...(j.acceptedAt ? { acceptedAt: j.acceptedAt.toISOString() } : {}),
    ...(j.completedAt ? { completedAt: j.completedAt.toISOString() } : {}),
    createdAt: j.createdAt.toISOString(),
    updatedAt: j.updatedAt.toISOString(),
  };
}

export function mapTrackingEvent(e: {
  id: string;
  orderId: string;
  source: string;
  status: string;
  note: string | null;
  lat: number | null;
  lng: number | null;
  createdAt: Date;
}): TrackingEvent {
  return {
    id: e.id,
    orderId: e.orderId,
    source: e.source,
    status: e.status,
    ...(e.note !== null ? { note: e.note } : {}),
    ...(e.lat !== null ? { lat: e.lat } : {}),
    ...(e.lng !== null ? { lng: e.lng } : {}),
    createdAt: e.createdAt.toISOString(),
  };
}

export function mapRoutingDecision(d: {
  id: string;
  orderId: string;
  shopId: string | null;
  geoScore: number;
  costScore: number;
  capacityScore: number;
  capabilityScore: number;
  totalScore: number;
  chosen: boolean;
  createdAt: Date;
}): RoutingDecisionResponse {
  return {
    id: d.id,
    orderId: d.orderId,
    ...(d.shopId ? { shopId: d.shopId } : {}),
    geoScore: d.geoScore,
    costScore: d.costScore,
    capacityScore: d.capacityScore,
    capabilityScore: d.capabilityScore,
    totalScore: d.totalScore,
    chosen: d.chosen,
    createdAt: d.createdAt.toISOString(),
  };
}

export function mapPayment(p: {
  id: string;
  orderId: string;
  stripeCheckoutSessionId: string | null;
  stripePaymentIntentId: string | null;
  status: string;
  amount: number;
  currency: string;
  createdAt: Date;
  updatedAt: Date;
}): PaymentResponse {
  return {
    id: p.id,
    orderId: p.orderId,
    ...(p.stripeCheckoutSessionId ? { stripeCheckoutSessionId: p.stripeCheckoutSessionId } : {}),
    ...(p.stripePaymentIntentId ? { stripePaymentIntentId: p.stripePaymentIntentId } : {}),
    status: p.status as PaymentResponse["status"],
    amount: p.amount,
    currency: p.currency,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

export function mapWebhook(wh: { id: string; url: string; events: string; active: boolean; createdAt: Date; updatedAt: Date }) {
  return {
    id: wh.id,
    url: wh.url,
    events: wh.events,
    active: wh.active,
    createdAt: wh.createdAt.toISOString(),
    updatedAt: wh.updatedAt.toISOString(),
  };
}