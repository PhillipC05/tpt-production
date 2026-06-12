import type {
  CreditTransactionType,
  DeliveryMethod,
  OrderStatus,
  PricingRuleType,
  SourceType,
} from "./enums";

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export type JsonObject = Record<string, JsonValue>;

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface Address {
  line1: string;
  line2?: string;
  city?: string;
  region?: string;
  postalCode?: string;
  country?: string;
  lat?: number;
  lng?: number;
}

export interface DesignFile {
  id: string;
  listingId?: string;
  uploaderId: string;
  fileKey: string;
  fileType: string;
  drmEnabled?: boolean;
  metadata?: JsonObject;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export type PriceDecayCurve = "linear" | "exponential" | "step";

export interface PriceDecayStep {
  at: number;
  price: number;
}

export interface PriceDecaySchedule {
  startDate: Date | string;
  endDate: Date | string;
  startPrice: number;
  endPrice: number;
  curve?: PriceDecayCurve;
  steps?: PriceDecayStep[];
}

export interface PricingRule {
  id: string;
  listingId: string;
  type: PricingRuleType;
  decaySchedule?: PriceDecaySchedule | JsonObject;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export interface ProductListing {
  id: string;
  title: string;
  description: string;
  category?: string;
  sourceType: SourceType;
  price: number;
  currency: string;
  active?: boolean;
  designFiles?: DesignFile[];
  pricingRules?: PricingRule[];
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export interface CreateProductListingInput {
  title: string;
  description: string;
  category?: string;
  sourceType: SourceType;
  price: number;
  currency?: string;
  active?: boolean;
  designFileIds?: string[];
}

export type UpdateProductListingInput = Partial<CreateProductListingInput>;

export interface DesignUploadInput {
  listingId?: string;
  uploaderId: string;
  fileName: string;
  fileType: string;
  drmEnabled?: boolean;
}

export interface DesignUploadResponse extends DesignFile {
  uploadUrl: string;
  storageProvider: "local" | "r2";
}

export interface CustomOrderRequest {
  id: string;
  name?: string;
  email?: string;
  phone?: string;
  request: string;
  status: string;
  metadata?: JsonObject;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export interface CreateCustomOrderRequestInput {
  name?: string;
  email?: string;
  phone?: string;
  request: string;
  metadata?: JsonObject;
}

export interface ShopCapability {
  id?: string;
  shopId?: string;
  material: string;
  machineType: string;
  category: string;
  createdAt?: Date | string;
}

export interface MakerShopCandidate {
  id: string;
  name?: string;
  location?: Coordinates;
  active?: boolean;
  capacity?: number;
  capabilities?: ShopCapability[];
  metadata?: JsonObject;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export interface SupplierCandidate {
  id: string;
  name?: string;
  apiConfig?: JsonObject;
  active?: boolean;
  metadata?: JsonObject;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export interface CreateOrderItemInput {
  listingId?: string;
  designFileId?: string;
  quantity: number;
  unitPrice?: number;
  category?: string;
  material?: string;
  machineType?: string;
  metadata?: JsonObject;
}

export interface OrderItem extends CreateOrderItemInput {
  id: string;
  orderId: string;
  unitPrice: number;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export interface CreateOrderInput {
  userId: string;
  status?: OrderStatus;
  items: CreateOrderItemInput[];
  deliveryAddress?: Address;
  deliveryMethod?: DeliveryMethod;
  metadata?: JsonObject;
}

export interface OrderInput extends CreateOrderInput {
  id?: string;
  status: OrderStatus;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export interface OrderResponse extends OrderInput {
  id: string;
  items: OrderItem[];
}

export interface RoutingCandidate {
  id: string;
  shopId?: string;
  supplierId?: string;
  location?: Coordinates;
  active?: boolean;
  capacity?: number;
  capabilities?: ShopCapability[];
  costEstimate?: number;
  deliveryMethods?: readonly DeliveryMethod[];
  metadata?: JsonObject;
  shop?: MakerShopCandidate;
  supplier?: SupplierCandidate;
}

export interface RoutingResult {
  candidateId: string;
  shopId?: string;
  supplierId?: string;
  geoScore: number;
  costScore: number;
  capacityScore: number;
  capabilityScore: number;
  totalScore: number;
  chosen: boolean;
  rank: number;
  reason?: string;
}

export interface TrackingEventPayload {
  orderId: string;
  source: string;
  status: string;
  note?: string;
  lat?: number;
  lng?: number;
  createdAt?: Date | string;
}

export interface TrackingEvent extends TrackingEventPayload {
  id: string;
}

export interface CreditAccount {
  id: string;
  userId: string;
  balance: number;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export interface CreditTransaction {
  id?: string;
  accountId: string;
  amount: number;
  type: CreditTransactionType;
  note?: string;
  createdAt?: Date | string;
}

export interface CreditBalanceResponse {
  accountId: string;
  userId: string;
  balance: number;
  currency?: string;
}

export interface CreditTransactionResponse {
  accountId: string;
  userId: string;
  balance: number;
  transactions: CreditTransaction[];
}

export interface ErrorPayload {
  code: string;
  message: string;
  details?: JsonObject;
}

export interface ApiResponseMeta {
  requestId?: string;
  timestamp?: Date | string;
}

export interface ApiResponse<TData = unknown> {
  data?: TData;
  error?: ErrorPayload;
  meta?: ApiResponseMeta;
}

export interface CreateOrderResponse {
  order: OrderResponse;
  price: number;
  routing?: RoutingResult[];
}

export interface ResolvePriceBreakdown {
  listingId: string;
  price: number;
  currency: string;
  ruleType?: PricingRuleType;
  decay?: {
    price: number;
    progress: number;
    curve: PriceDecayCurve;
  };
}