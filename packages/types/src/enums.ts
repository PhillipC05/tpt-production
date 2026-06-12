export const UserRole = {
  CONSUMER: "CONSUMER",
  MAKER: "MAKER",
  SUPPLIER: "SUPPLIER",
  ADMIN: "ADMIN",
  AGENT: "AGENT",
} as const;

export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const SourceType = {
  LOCAL_PRINT: "LOCAL_PRINT",
  OVERSEAS: "OVERSEAS",
  CUSTOM: "CUSTOM",
} as const;

export type SourceType = (typeof SourceType)[keyof typeof SourceType];

export const OrderStatus = {
  PENDING: "PENDING",
  ROUTED: "ROUTED",
  IN_PRODUCTION: "IN_PRODUCTION",
  IN_TRANSIT: "IN_TRANSIT",
  DELIVERED: "DELIVERED",
  CANCELLED: "CANCELLED",
} as const;

export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];

export const FulfillmentJobStatus = {
  PENDING: "PENDING",
  ACCEPTED: "ACCEPTED",
  IN_PROGRESS: "IN_PROGRESS",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
  CANCELLED: "CANCELLED",
} as const;

export type FulfillmentJobStatus =
  (typeof FulfillmentJobStatus)[keyof typeof FulfillmentJobStatus];

export const DeliveryMethod = {
  COURIER: "COURIER",
  DRONE: "DRONE",
  PICKUP: "PICKUP",
  AUTONOMOUS: "AUTONOMOUS",
} as const;

export type DeliveryMethod =
  (typeof DeliveryMethod)[keyof typeof DeliveryMethod];

export const CreditTransactionType = {
  EARNED: "EARNED",
  SPENT: "SPENT",
  ADJUSTMENT: "ADJUSTMENT",
} as const;

export type CreditTransactionType =
  (typeof CreditTransactionType)[keyof typeof CreditTransactionType];

export const PricingRuleType = {
  FIXED: "FIXED",
  COST_PLUS: "COST_PLUS",
  FREE: "FREE",
  DECAY: "DECAY",
} as const;

export type PricingRuleType =
  (typeof PricingRuleType)[keyof typeof PricingRuleType];