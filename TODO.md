# tpt-production — Build Checklist

> Track all tasks across every phase. Check off `[ ]` → `[x]` as work is completed.

---

## Phase 1 — Foundation

### Monorepo & Tooling
- [x] Initialise pnpm workspace (`pnpm init`, `pnpm-workspace.yaml`)
- [x] Add Turborepo (`turbo.json` with dev/build/lint pipelines)
- [x] Root `package.json` with shared dev deps (TypeScript, ESLint, Prettier)
- [x] `.gitignore`, `.env.example`, `tsconfig.base.json`
- [x] Git repository initialised (`git init`, initial commit)


### Infrastructure
- [x] `docker-compose.yml` — PostgreSQL 16 service
- [x] `docker-compose.yml` — Redis 7 service
- [x] `.env.example` with `DATABASE_URL`, `REDIS_URL`, all feature flags
- [x] Confirm `docker compose up` starts cleanly

### packages/db (Prisma)
- [x] `packages/db/package.json` and `tsconfig.json`
- [x] `prisma/schema.prisma` — User model (id, email, role enum: CONSUMER, MAKER, SUPPLIER, ADMIN, AGENT)
- [x] `prisma/schema.prisma` — MakerShop model (userId, name, location lat/lng, active, capacity)
- [x] `prisma/schema.prisma` — ShopCapability model (shopId, material, machineType, category)
- [x] `prisma/schema.prisma` — Supplier model (name, apiConfig JSON, active)
- [x] `prisma/schema.prisma` — ProductListing model (title, description, sourceType enum: LOCAL_PRINT / OVERSEAS / CUSTOM, price, currency, active)
- [x] `prisma/schema.prisma` — DesignFile model (listingId optional, uploaderId, fileKey, fileType, drmEnabled)
- [x] `prisma/schema.prisma` — DesignRoyalty model (designFileId, orderId, recipientId, amount, credits)
- [x] `prisma/schema.prisma` — Order model (userId, status enum: PENDING / ROUTED / IN_PRODUCTION / IN_TRANSIT / DELIVERED / CANCELLED)
- [x] `prisma/schema.prisma` — OrderItem model (orderId, listingId, designFileId, quantity, unitPrice)
- [x] `prisma/schema.prisma` — FulfillmentJob model (orderId, shopId, supplierId, status, acceptedAt, completedAt)
- [x] `prisma/schema.prisma` — RoutingDecision model (orderId, shopId, geoScore, costScore, capacityScore, capabilityScore, totalScore, chosen)
- [x] `prisma/schema.prisma` — TrackingEvent model (orderId, source, status, note, lat, lng, createdAt)
- [x] `prisma/schema.prisma` — DeliveryAssignment model (orderId, method enum: COURIER / DRONE / PICKUP / AUTONOMOUS, externalRef)
- [x] `prisma/schema.prisma` — CreditAccount model (userId, balance)
- [x] `prisma/schema.prisma` — CreditTransaction model (accountId, amount, type enum: EARNED / SPENT / ADJUSTMENT, note)
- [x] `prisma/schema.prisma` — PricingRule model (listingId, type enum: FIXED / COST_PLUS / FREE / DECAY, decaySchedule JSON optional)
- [x] `prisma/schema.prisma` — ApiKey model (userId, keyHash, name, scopes, lastUsedAt)
- [x] Run first migration (`prisma migrate dev --name init`)
- [x] Prisma client exported from `packages/db/src/index.ts`

### packages/types
- [x] `packages/types/package.json` and `tsconfig.json`
- [x] Shared enums mirroring Prisma enums (OrderStatus, UserRole, DeliveryMethod, etc.)
- [x] Shared API request/response types (CreateOrderInput, RoutingResult, TrackingEventPayload, etc.)

### packages/core
- [x] `packages/core/package.json` and `tsconfig.json`
- [x] `src/flags.ts` — reads all `ENABLE_*` env vars, exports typed feature flag object
- [x] `src/routing/index.ts` — `RouteOrder(order, candidates[]) → RoutingResult[]` interface
- [x] `src/routing/scorer.ts` — geo, cost, capacity, capability scoring functions
- [x] `src/routing/weights.ts` — configurable weight defaults (env-overridable)
- [x] `src/pricing/index.ts` — `ResolvePrice(listing, flags) → number` (handles free economy, decay)
- [x] `src/pricing/decay.ts` — price decay schedule evaluator
- [x] `src/credits/index.ts` — `EarnCredits`, `SpendCredits` helpers (no-op when flag off)

### packages/ui
- [x] `packages/ui/package.json` and `tsconfig.json`
- [x] Tailwind config shared base
- [x] shadcn/ui components added: Button, Card, Badge, Input, Label, Select, Table, Dialog, Tabs, Toast
- [x] `src/index.ts` re-exports all components

---

## Phase 2 — Marketplace

### apps/api — Catalog & Designs
- [x] Hono app scaffold (`apps/api/src/index.ts`) with OpenAPI middleware
- [x] `GET /catalog` — paginated, filterable product listing (sourceType, category, priceMin/Max, search)
- [x] `GET /catalog/:id` — single listing with design files
- [x] `POST /catalog` — admin: create listing
- [x] `PUT /catalog/:id` — admin: update listing
- [x] `DELETE /catalog/:id` — admin: deactivate listing
- [x] `POST /designs/upload` — returns presigned R2 (or local) URL, creates DesignFile record
- [x] `GET /designs/:id` — fetch design metadata (access-controlled if DRM enabled)
- [x] `POST /orders/custom` — submit a free-text custom order request

### apps/api — Shop & Supplier Onboarding
- [x] `POST /shops/onboard` — self-serve shop registration
- [x] `PUT /shops/:id` — update shop details / capabilities
- [x] `GET /shops/:id/capacity` — returns current available capacity
- [x] `POST /shops/:id/capabilities` — add/update capabilities (materials, machines, categories)
- [x] `POST /suppliers` — admin: add supplier with API config
- [x] `GET /suppliers` — admin: list suppliers

### apps/web — Consumer Marketplace
- [x] Next.js 15 App Router scaffold (`apps/web`)
- [x] Tailwind + shadcn/ui wired up
- [x] `/` homepage — hero, featured listings, categories
- [x] `/catalog` — browse/search/filter product listings
- [x] `/catalog/[id]` — listing detail page (description, price, design files, order CTA)
- [x] `/designs/upload` — design file upload form (STL, OBJ, 3MF, STEP)
- [x] `/orders/custom` — custom order request form

### apps/admin — Maker Portal
- [x] Next.js 15 scaffold (`apps/admin`)
- [x] `/shops/onboard` — shop registration wizard (name, location, capabilities)
- [x] `/shops/dashboard` — shop's incoming jobs, capacity controls
- [x] `/catalog/new` — admin: create product listing
- [x] `/catalog` — admin: list/edit/deactivate listings

---

## Phase 3 — Order Lifecycle

### apps/api — Orders & Routing
- [x] `POST /orders` — place order, validates items, triggers routing engine async via BullMQ
- [x] `GET /orders` — consumer: list own orders
- [x] `GET /orders/:id` — consumer: order detail
- [x] `POST /orders/:id/cancel` — cancel if still PENDING
- [x] BullMQ queue setup (`routing-queue`) with Redis
- [x] Routing worker: fetches candidate shops, runs `RouteOrder`, persists `RoutingDecision`, creates `FulfillmentJob`, updates order to ROUTED
- [x] `POST /fulfillment-jobs/:id/accept` — shop accepts job, order → IN_PRODUCTION
- [x] `POST /fulfillment-jobs/:id/complete` — shop marks done, order → IN_TRANSIT (or DELIVERED if pickup)
- [x] `POST /fulfillment-jobs/:id/reject` — shop rejects, triggers re-routing
- [x] Admin endpoint: `GET /admin/routing-decisions` — see routing scores for any order

### apps/web — Order Flow
- [x] `/cart` — cart page (add/remove items, quantity)
- [x] `/checkout` — review order, address, payment/credit selection (respects feature flags)
- [x] `/orders` — order history list
- [x] `/orders/[id]` — order detail with status timeline

### apps/admin — Fulfillment
- [x] `/jobs` — shop: list assigned fulfillment jobs
- [x] `/jobs/[id]` — job detail, accept/reject/complete actions
- [x] `/admin/orders` — platform admin: all orders, routing decisions, override routing

---

## Phase 4 — Live Tracking

### apps/api — Tracking
- [x] `POST /tracking/:orderId` — shop/carrier/agent pushes a TrackingEvent (authenticated)
- [x] `POST /webhooks/tracking` — external carrier webhook ingestion (validates signature)
- [x] `GET /orders/:id/tracking` — full tracking event history
- [x] Socket.io server wired into Hono API (or separate ws server)
- [x] On new TrackingEvent: emit to room `order:<id>` via Socket.io
- [x] `DeliveryAssignment` created when order moves to IN_TRANSIT

### apps/web — Live Status
- [x] `/orders/[id]` — Socket.io client subscribes to `order:<id>` room
- [x] Live status timeline component (status steps + most recent TrackingEvent)
- [ ] Map component (optional) showing last known lat/lng from TrackingEvent
- [x] Push/toast notification on status change

---

## Phase 5 — Economy Layer (all feature-flagged)

### Credits System (`ENABLE_CREDITS=true`)
- [x] `CreditAccount` auto-created on user registration
- [x] `GET /credits/balance` — return balance
- [x] `GET /credits/transactions` — transaction history
- [x] Credit deduction on order placement
- [x] Credit refund on order cancellation

### DRM / Royalties (`ENABLE_DRM=true`)
- [x] On `FulfillmentJob` complete: if DesignFile has DRM, create `DesignRoyalty` record
- [x] `POST /royalties/payout` — admin trigger to process pending royalties into credits or payment
- [x] `GET /designs/:id/royalties` — designer: see earnings per design

### Payments (`ENABLE_PAYMENTS=true`)
- [x] Stripe SDK installed and configured
- [x] `POST /payments/checkout-session` — create Stripe checkout for order
- [x] `POST /webhooks/stripe` — handle payment_intent.succeeded, refunds
- [x] Payment status linked to Order; order only routes after payment confirmed
- [x] Admin: `GET /admin/payments` — payment records

### Free Economy (`ENABLE_FREE_ECONOMY=true`)
- [x] `ResolvePrice` returns 0 for all listings when flag active
- [x] Web checkout hides payment UI and credit selection
- [x] Orders route immediately without payment step

### Price Decay (`ENABLE_PRICE_DECAY=true`)
- [x] `PricingRule` decay schedule stored as JSON (startDate, endDate, startPrice, endPrice, curve)
- [x] `decay.ts` evaluates price for current date against schedule
- [x] Cron job (BullMQ scheduled): recalculate and cache decay prices daily

---

## Phase 6 — AI Agent Layer (`ENABLE_AI_AGENTS=true`)

### API Key Auth
- [x] `POST /auth/api-keys` — authenticated user creates an API key (hashed in DB)
- [x] `DELETE /auth/api-keys/:id` — revoke key
- [x] Hono middleware: `X-API-Key` header auth resolves to User with AGENT role
- [x] Scope validation per endpoint (order:write, shop:write, tracking:write, etc.)

### Agent-Facing Endpoints
- [x] All existing endpoints work with API key auth (same routes, agent-scoped permissions)
- [x] `GET /openapi.json` — full OpenAPI spec served (for agent auto-discovery)
- [x] `POST /shops/:id/capacity` — shop bot reports available capacity
- [x] `POST /shops/:id/heartbeat` — AI shop signals it is online/active
- [x] `GET /fulfillment-jobs?shopId=X&status=PENDING` — agent polling for new jobs

### AI Routing Plugin
- [x] `RouteOrder` interface accepts optional `customScorer` function parameter
- [x] `POST /admin/routing/scorer` — admin can enable/disable AI scorer
- [x] Stub AI scorer that calls an external LLM endpoint (no-op if not configured)

### Webhooks to Agents
- [x] `POST /admin/webhooks` — register a webhook URL for events (job.created, order.status_changed, etc.)
- [x] Webhook dispatcher: on key events, POST payload to registered URLs with HMAC signature

---

## Phase 7 — Polish & Production Readiness

### Security
- [x] Rate limiting on all public endpoints (hono-rate-limiter, 120 req/min per IP)
- [x] CORS configured (whitelist web + admin origins via ALLOWED_ORIGINS env)
- [x] Helmet-equivalent security headers on API
- [x] Input validation on all routes (Zod schemas via @hono/zod-openapi)
- [x] Stripe webhook signature verification (via STRIPE_WEBHOOK_SECRET env)
- [x] API key stored as SHA-256 hash, raw key never returned after creation
- [x] File upload validation (MIME type allowlist + 100 MB size limit)

### Observability
- [x] Structured JSON logging (pino) in API
- [x] Request ID middleware (injects X-Request-ID, logs with every request)
- [x] BullMQ job failure logging + dead-letter queues (routing-dlq, decay-price-dlq)
- [x] Health check endpoint `GET /health` (DB ping, Redis TCP check)

### Testing
- [x] Unit tests for routing scorer (packages/core) — 31 tests
- [x] Unit tests for pricing / decay (packages/core) — 26 tests
- [x] Integration tests for order placement → routing → fulfillment job creation
- [x] Integration test for credit deduction on order
- [x] Integration test for DRM royalty on job completion
- [ ] E2E test (Playwright): consumer places order, shop completes, tracking updates

### Deployment
- [x] `Dockerfile` for apps/api
- [x] `Dockerfile` for apps/web
- [x] `Dockerfile` for apps/admin
- [x] `.dockerignore` at repo root
- [x] `docker-compose.prod.yml` with all services + nginx reverse proxy
- [x] `nginx/nginx.conf` — path-based routing (`/api/` → api, `/` → web, port 3001 → admin) with WebSocket support
- [x] Environment variable documentation in `docs/env.md`
- [x] Database migration strategy documented (`prisma migrate deploy`)
- [x] `CLAUDE.md` written for repo orientation
- [x] Switch `packages/db/prisma/schema.prisma` provider from `sqlite` → `postgresql` before first production deploy (see `docs/deployment.md` — set DATABASE_URL to PostgreSQL connection string; dev keeps SQLite)

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
