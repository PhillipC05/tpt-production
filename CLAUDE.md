# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**TPT Production** is a platform for fully automated production — where 3D printing, robotics, and AI agents coordinate to fulfil orders end-to-end with minimal human involvement. This is a pnpm + Turborepo monorepo with three apps and four shared packages.

**Current status**: Phases 1–7 complete. All core features are implemented and production-ready.

## Commands

Run from the repo root unless otherwise noted.

```bash
pnpm dev          # Turborepo watch mode across all packages
pnpm build        # Build all packages (cached via Turborepo)
pnpm lint         # ESLint across workspace
pnpm type-check   # TypeScript type-check across workspace
pnpm format       # Prettier (100-char width, double quotes, 2-space indent)
```

Database (run from `packages/db`):
```bash
pnpm migrate:dev  # Apply Prisma migrations (dev)
pnpm studio       # Open Prisma Studio UI
```

Infrastructure (repo root):
```bash
docker compose up -d                                      # Start PostgreSQL 16 (5432) + Redis 7 (6379)
docker compose -f docker-compose.prod.yml up -d --build  # Full production stack
```

Tests:
```bash
pnpm --filter @tpt/core test       # Unit tests: routing scorer, pricing, decay
pnpm --filter @tpt/api test        # Integration tests: order lifecycle, credits, DRM
```

## Architecture

### Apps

| App | Port | Purpose |
|---|---|---|
| `apps/api` | 8787 | Hono REST API — ~50 endpoints, BullMQ workers, Socket.io |
| `apps/web` | 3000 | Next.js 15 consumer marketplace |
| `apps/admin` | 3001 | Next.js 15 maker/admin portal |

### Packages

| Package | Purpose |
|---|---|
| `packages/db` | Prisma ORM — schema (19 models), migrations, generated client |
| `packages/types` | Shared TypeScript types and enums (imported by every other package) |
| `packages/core` | Business logic: routing engine, pricing, credits, feature flags |
| `packages/ui` | Shared shadcn/ui components (Button, Card, Badge, Input, etc.) |

### Feature Flags

All flags live in `packages/core/src/flags.ts` and default to `false` (except `ENABLE_FREE_ECONOMY=true`). They gate: credits, DRM/royalties, Stripe payments, price decay, and AI agent endpoints. Always check flags before implementing features that touch these domains. Features must be fully functional (graceful no-op) when the relevant flag is off.

### Core Business Logic (`packages/core`)

- **Routing engine** (`src/routing/index.ts`) — `routeOrder()` scores maker candidates using Haversine geo distance, cost, capacity, and capabilities. Weights are env-configurable; accepts a `customScorer` plugin for AI integration.
- **Pricing** (`src/pricing/index.ts`) — `resolvePrice()` handles `FIXED`, `COST_PLUS`, `FREE`, and `DECAY` listing types. Decay supports linear, exponential, and step curves.
- **Credits** (`src/credits/index.ts`) — `earnCredits()` / `spendCredits()` are no-ops when `ENABLE_CREDITS` is off; otherwise validate balance and write transaction records.

### Database Schema

19 Prisma models: `User` (roles: CONSUMER, MAKER, SUPPLIER, ADMIN, AGENT), `MakerShop`, `ShopCapability`, `Supplier`, `ProductListing`, `CustomOrderRequest`, `DesignFile`, `DesignRoyalty`, `Order`, `OrderItem`, `FulfillmentJob`, `RoutingDecision`, `TrackingEvent`, `DeliveryAssignment`, `CreditAccount`, `CreditTransaction`, `PricingRule`, `ApiKey`, `Payment`, `Webhook`.

Dev database is SQLite; production target is PostgreSQL 16. To switch: update `DATABASE_URL` in `.env` to a PostgreSQL connection string and run `prisma migrate deploy`. See `docs/deployment.md`.

### TypeScript Config

`tsconfig.base.json` at root is extended by every package. Strict mode, `ES2022` target, path aliases configured per-package.

### API Auth

- **Admin token**: `Authorization: Bearer <ADMIN_API_TOKEN>` or `X-API-Key` header
- **API keys**: SHA-256 hashed in DB, validated via `X-API-Key` header (scoped per endpoint)
- **Webhooks**: HMAC-SHA256 signature validation (constant-time comparison)
- **Consumer auth**: Not implemented — gated by payment/credit balance when those flags are enabled

### Production Infrastructure

- `docker-compose.prod.yml` — full stack: Postgres, Redis, migrate runner, API, web, admin, nginx
- `nginx/nginx.conf` — path-based routing: `/api/*` → api:8787, `/socket.io/*` → WebSocket upgrade, `/*` → web:3000, port 3001 → admin:3001
- Multi-stage Dockerfiles for all three apps (Node 20 Alpine, `.next/standalone` for Next.js)

## Phase Roadmap (from TODO.md)

| Phase | Status |
|---|---|
| 1 – Foundation (monorepo, DB schema, core packages) | Complete |
| 2 – Marketplace API (Hono + OpenAPI) + web/admin UI | Complete |
| 3 – Order lifecycle + BullMQ job queue | Complete |
| 4 – Live tracking + WebSocket (Socket.io) | Complete |
| 5 – Credits economy + Stripe + DRM royalties | Complete |
| 6 – AI agent endpoints + API keys + webhooks | Complete |
| 7 – Production hardening (rate limiting, security headers, Docker, tests) | Complete |

Backlog items (not started): drone delivery routing, photo-to-3D-model AI, multi-currency, i18n, SMS/email notifications, reviews, dispute resolution, analytics dashboard. Check `TODO.md` for the full list.
