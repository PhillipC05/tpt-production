# tpt-production — Build Checklist

> Track all tasks across every phase. Check off `[ ]` → `[x]` as work is completed.

---

## Phase 1 — Foundation

### Monorepo & Tooling
- [ ] Initialise pnpm workspace (`pnpm init`, `pnpm-workspace.yaml`)
- [ ] Add Turborepo (`turbo.json` with dev/build/lint pipelines)
- [ ] Root `package.json` with shared dev deps (TypeScript, ESLint, Prettier)
- [ ] `.gitignore`, `.env.example`, `tsconfig.base.json`
- [x] Git repository initialised (`git init`, initial commit)


### Infrastructure
- [ ] `docker-compose.yml` — PostgreSQL 16 service
- [ ] `docker-compose.yml` — Redis 7 service
- [ ] `.env.example` with `DATABASE_URL`, `REDIS_URL`, all feature flags
- [ ] Confirm `docker compose up` starts cleanly

### packages/db (Prisma)
- [ ] `packages/db/package.json` and `tsconfig.json`
- [ ] `prisma/schema.prisma` — User model (id, email, role enum: CONSUMER, MAKER, SUPPLIER, ADMIN, AGENT)
- [ ] `prisma/schema.prisma` — MakerShop model (userId, name, location lat/lng, active, capacity)
- [ ] `prisma/schema.prisma` — ShopCapability model (shopId, material, machineType, category)
- [ ] `prisma/schema.prisma` — Supplier model (name, apiConfig JSON, active)
- [ ] `prisma/schema.prisma` — ProductListing model (title, description, sourceType enum: LOCAL_PRINT / OVERSEAS / CUSTOM, price, currency, active)
- [ ] `prisma/schema.prisma` — DesignFile model (listingId optional, uploaderId, fileKey, fileType, drmEnabled)
- [ ] `prisma/schema.prisma` — DesignRoyalty model (designFileId, orderId, recipientId, amount, credits)
- [ ] `prisma/schema.prisma` — Order model (userId, status enum: PENDING / ROUTED / IN_PRODUCTION / IN_TRANSIT / DELIVERED / CANCELLED)
- [ ] `prisma/schema.prisma` — OrderItem model (orderId, listingId, designFileId, quantity, unitPrice)
- [ ] `prisma/schema.prisma` — FulfillmentJob model (orderId, shopId, supplierId, status, acceptedAt, completedAt)
- [ ] `prisma/schema.prisma` — RoutingDecision model (orderId, shopId, geoScore, costScore, capacityScore, capabilityScore, totalScore, chosen)
- [ ] `prisma/schema.prisma` — TrackingEvent model (orderId, source, status, note, lat, lng, createdAt)
- [ ] `prisma/schema.prisma` — DeliveryAssignment model (orderId, method enum: COURIER / DRONE / PICKUP / AUTONOMOUS, externalRef)
- [ ] `prisma/schema.prisma` — CreditAccount model (userId, balance)
- [ ] `prisma/schema.prisma` — CreditTransaction model (accountId, amount, type enum: EARNED / SPENT / ADJUSTMENT, note)
- [ ] `prisma/schema.prisma` — PricingRule model (listingId, type enum: FIXED / COST_PLUS / FREE / DECAY, decaySchedule JSON optional)
- [ ] `prisma/schema.prisma` — ApiKey model (userId, keyHash, name, scopes, lastUsedAt)
- [ ] Run first migration (`prisma migrate dev --name init`)
- [ ] Prisma client exported from `packages/db/src/index.ts`

### packages/types
- [ ] `packages/types/package.json` and `tsconfig.json`
- [ ] Shared enums mirroring Prisma enums (OrderStatus, UserRole, DeliveryMethod, etc.)
- [ ] Shared API request/response types (CreateOrderInput, RoutingResult, TrackingEventPayload, etc.)

### packages/core
- [ ] `packages/core/package.json` and `tsconfig.json`
- [ ] `src/flags.ts` — reads all `ENABLE_*` env vars, exports typed feature flag object
- [ ] `src/routing/index.ts` — `RouteOrder(order, candidates[]) → RoutingResult[]` interface
- [ ] `src/routing/scorer.ts` — geo, cost, capacity, capability scoring functions
- [ ] `src/routing/weights.ts` — configurable weight defaults (env-overridable)
- [ ] `src/pricing/index.ts` — `ResolvePrice(listing, flags) → number` (handles free economy, decay)
- [ ] `src/pricing/decay.ts` — price decay schedule evaluator
- [ ] `src/credits/index.ts` — `EarnCredits`, `SpendCredits` helpers (no-op when flag off)

### packages/ui
- [ ] `packages/ui/package.json` and `tsconfig.json`
- [ ] Tailwind config shared base
- [ ] shadcn/ui components added: Button, Card, Badge, Input, Label, Select, Table, Dialog, Tabs, Toast
- [ ] `src/index.ts` re-exports all components

---

## Phase 2 — Marketplace

### apps/api — Catalog & Designs
- [ ] Hono app scaffold (`apps/api/src/index.ts`) with OpenAPI middleware
- [ ] `GET /catalog` — paginated, filterable product listing (sourceType, category, priceMin/Max, search)
- [ ] `GET /catalog/:id` — single listing with design files
- [ ] `POST /catalog` — admin: create listing
- [ ] `PUT /catalog/:id` — admin: update listing
- [ ] `DELETE /catalog/:id` — admin: deactivate listing
- [ ] `POST /designs/upload` — returns presigned R2 (or local) URL, creates DesignFile record
- [ ] `GET /designs/:id` — fetch design metadata (access-controlled if DRM enabled)
- [ ] `POST /orders/custom` — submit a free-text custom order request

### apps/api — Shop & Supplier Onboarding
- [ ] `POST /shops/onboard` — self-serve shop registration
- [ ] `PUT /shops/:id` — update shop details / capabilities
- [ ] `GET /shops/:id/capacity` — returns current available capacity
- [ ] `POST /shops/:id/capabilities` — add/update capabilities (materials, machines, categories)
- [ ] `POST /suppliers` — admin: add supplier with API config
- [ ] `GET /suppliers` — admin: list suppliers

### apps/web — Consumer Marketplace
- [ ] Next.js 15 App Router scaffold (`apps/web`)
- [ ] Tailwind + shadcn/ui wired up
- [ ] `/` homepage — hero, featured listings, categories
- [ ] `/catalog` — browse/search/filter product listings
- [ ] `/catalog/[id]` — listing detail page (description, price, design files, order CTA)
- [ ] `/designs/upload` — design file upload form (STL, OBJ, 3MF, STEP)
- [ ] `/orders/custom` — custom order request form

### apps/admin — Maker Portal
- [ ] Next.js 15 scaffold (`apps/admin`)
- [ ] `/shops/onboard` — shop registration wizard (name, location, capabilities)
- [ ] `/shops/dashboard` — shop's incoming jobs, capacity controls
- [ ] `/catalog/new` — admin: create product listing
- [ ] `/catalog` — admin: list/edit/deactivate listings

---

## Phase 3 — Order Lifecycle

### apps/api — Orders & Routing
- [ ] `POST /orders` — place order, validates items, triggers routing engine async via BullMQ
- [ ] `GET /orders` — consumer: list own orders
- [ ] `GET /orders/:id` — consumer: order detail
- [ ] `POST /orders/:id/cancel` — cancel if still PENDING
- [ ] BullMQ queue setup (`routing-queue`) with Redis
- [ ] Routing worker: fetches candidate shops, runs `RouteOrder`, persists `RoutingDecision`, creates `FulfillmentJob`, updates order to ROUTED
- [ ] `POST /fulfillment-jobs/:id/accept` — shop accepts job, order → IN_PRODUCTION
- [ ] `POST /fulfillment-jobs/:id/complete` — shop marks done, order → IN_TRANSIT (or DELIVERED if pickup)
- [ ] `POST /fulfillment-jobs/:id/reject` — shop rejects, triggers re-routing
- [ ] Admin endpoint: `GET /admin/routing-decisions` — see routing scores for any order

### apps/web — Order Flow
- [ ] `/cart` — cart page (add/remove items, quantity)
- [ ] `/checkout` — review order, address, payment/credit selection (respects feature flags)
- [ ] `/orders` — order history list
- [ ] `/orders/[id]` — order detail with status timeline

### apps/admin — Fulfillment
- [ ] `/jobs` — shop: list assigned fulfillment jobs
- [ ] `/jobs/[id]` — job detail, accept/reject/complete actions
- [ ] `/admin/orders` — platform admin: all orders, routing decisions, override routing

---

## Phase 4 — Live Tracking

### apps/api — Tracking
- [ ] `POST /tracking/:orderId` — shop/carrier/agent pushes a TrackingEvent (authenticated)
- [ ] `POST /webhooks/tracking` — external carrier webhook ingestion (validates signature)
- [ ] `GET /orders/:id/tracking` — full tracking event history
- [ ] Socket.io server wired into Hono API (or separate ws server)
- [ ] On new TrackingEvent: emit to room `order:<id>` via Socket.io
- [ ] `DeliveryAssignment` created when order moves to IN_TRANSIT

### apps/web — Live Status
- [ ] `/orders/[id]` — Socket.io client subscribes to `order:<id>` room
- [ ] Live status timeline component (status steps + most recent TrackingEvent)
- [ ] Map component (optional) showing last known lat/lng from TrackingEvent
- [ ] Push/toast notification on status change

---

## Phase 5 — Economy Layer (all feature-flagged)

### Credits System (`ENABLE_CREDITS=true`)
- [ ] `CreditAccount` auto-created on user registration
- [ ] `GET /credits/balance` — return balance
- [ ] `GET /credits/transactions` — transaction history
- [ ] Credit deduction on order placement
- [ ] Credit refund on order cancellation

### DRM / Royalties (`ENABLE_DRM=true`)
- [ ] On `FulfillmentJob` complete: if DesignFile has DRM, create `DesignRoyalty` record
- [ ] `POST /royalties/payout` — admin trigger to process pending royalties into credits or payment
- [ ] `GET /designs/:id/royalties` — designer: see earnings per design

### Payments (`ENABLE_PAYMENTS=true`)
- [ ] Stripe SDK installed and configured
- [ ] `POST /payments/checkout-session` — create Stripe checkout for order
- [ ] `POST /webhooks/stripe` — handle payment_intent.succeeded, refunds
- [ ] Payment status linked to Order; order only routes after payment confirmed
- [ ] Admin: `GET /admin/payments` — payment records

### Free Economy (`ENABLE_FREE_ECONOMY=true`)
- [ ] `ResolvePrice` returns 0 for all listings when flag active
- [ ] Web checkout hides payment UI and credit selection
- [ ] Orders route immediately without payment step

### Price Decay (`ENABLE_PRICE_DECAY=true`)
- [ ] `PricingRule` decay schedule stored as JSON (startDate, endDate, startPrice, endPrice, curve)
- [ ] `decay.ts` evaluates price for current date against schedule
- [ ] Cron job (BullMQ scheduled): recalculate and cache decay prices daily

---

## Phase 6 — AI Agent Layer (`ENABLE_AI_AGENTS=true`)

### API Key Auth
- [ ] `POST /auth/api-keys` — authenticated user creates an API key (hashed in DB)
- [ ] `DELETE /auth/api-keys/:id` — revoke key
- [ ] Hono middleware: `X-API-Key` header auth resolves to User with AGENT role
- [ ] Scope validation per endpoint (order:write, shop:write, tracking:write, etc.)

### Agent-Facing Endpoints
- [ ] All existing endpoints work with API key auth (same routes, agent-scoped permissions)
- [ ] `GET /openapi.json` — full OpenAPI spec served (for agent auto-discovery)
- [ ] `POST /shops/:id/capacity` — shop bot reports available capacity
- [ ] `POST /shops/:id/heartbeat` — AI shop signals it is online/active
- [ ] `GET /fulfillment-jobs?shopId=X&status=PENDING` — agent polling for new jobs

### AI Routing Plugin
- [ ] `RouteOrder` interface accepts optional `customScorer` function parameter
- [ ] `POST /admin/routing/scorer` — admin can enable/disable AI scorer
- [ ] Stub AI scorer that calls an external LLM endpoint (no-op if not configured)

### Webhooks to Agents
- [ ] `POST /admin/webhooks` — register a webhook URL for events (job.created, order.status_changed, etc.)
- [ ] Webhook dispatcher: on key events, POST payload to registered URLs with HMAC signature

---

## Phase 7 — Polish & Production Readiness

### Security
- [ ] Rate limiting on all public endpoints (hono-rate-limiter or upstash)
- [ ] CORS configured (whitelist web + admin origins)
- [ ] Helmet-equivalent security headers on API
- [ ] Input validation on all routes (Zod schemas)
- [ ] Stripe webhook signature verification
- [ ] API key stored as bcrypt hash, never returned after creation
- [ ] File upload validation (mime type, size limits)

### Observability
- [ ] Structured JSON logging (pino) in API
- [ ] Request ID middleware
- [ ] BullMQ job failure logging + dead-letter queue
- [ ] Health check endpoint `GET /health` (DB ping, Redis ping)

### Testing
- [ ] Unit tests for routing scorer (packages/core)
- [ ] Unit tests for pricing / decay (packages/core)
- [ ] Integration tests for order placement → routing → fulfillment job creation
- [ ] Integration test for credit deduction on order
- [ ] Integration test for DRM royalty on job completion
- [ ] E2E test (Playwright): consumer places order, shop completes, tracking updates

### Deployment
- [ ] `Dockerfile` for apps/api
- [ ] `Dockerfile` for apps/web
- [ ] `Dockerfile` for apps/admin
- [ ] `docker-compose.prod.yml` with all services + nginx reverse proxy
- [ ] Environment variable documentation in `docs/env.md`
- [ ] Database migration strategy documented (`prisma migrate deploy`)
- [ ] `CLAUDE.md` written for repo orientation

---

## Backlog / Future

- [ ] Drone / autonomous delivery routing module
- [ ] AI-powered product photo → 3D model generation (outsourced to external tools, upload result)
- [ ] Maker shop mobile-friendly PWA view
- [ ] Multi-currency support (exchange rate service integration)
- [ ] Supplier API integration library (generic adapter pattern)
- [ ] Gradual price decay visualisation (chart on listing page)
- [ ] Consumer reputation / review system
- [ ] Shop performance dashboard (jobs completed, avg time, ratings)
- [ ] Dispute resolution flow (consumer ↔ shop)
- [ ] Internationalisation (i18n) for web + admin
- [ ] SMS/email notifications (Resend or Postmark integration)
- [ ] Analytics dashboard (order volume, fulfillment times, economy metrics)
