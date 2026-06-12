# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**TPT Production** is a platform for fully automated production — where 3D printing, robotics, and AI agents coordinate to fulfil orders end-to-end with minimal human involvement. This is a pnpm + Turborepo monorepo currently in **Phase 1 (Foundation)**. The `packages/` directory holds shared libraries; app packages (`apps/`) have not been created yet.

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
docker compose up -d  # Start PostgreSQL 16 (5432) and Redis 7 (6379)
```

## Architecture

### Packages

| Package | Purpose |
|---|---|
| `packages/db` | Prisma ORM — schema, migrations, generated client |
| `packages/types` | Shared TypeScript types and enums (imported by every other package) |
| `packages/core` | Business logic: routing engine, pricing, credits, feature flags |

Apps (`apps/`) are planned but not yet scaffolded. Planned: Hono API server, Next.js 15 consumer marketplace, Next.js admin/maker portal.

### Feature Flags

All flags live in `packages/core/src/flags.ts` and default to `false` (except `ENABLE_FREE_ECONOMY=true`). They gate: credits, DRM/royalties, Stripe payments, price decay, and AI agent endpoints. Check flags before implementing any feature that touches these domains.

### Core Business Logic (`packages/core`)

- **Routing engine** (`src/routing/index.ts`) — `routeOrder()` scores maker candidates using Haversine geo distance, cost, capacity, and capabilities. Weights are configurable; accepts custom scorer plugins for AI integration.
- **Pricing** (`src/pricing/index.ts`) — `resolvePrice()` handles `FIXED`, `COST_PLUS`, `FREE`, and `DECAY` listing types. Decay supports linear, exponential, and step curves.
- **Credits** (`src/credits/index.ts`) — `earnCredits()` / `spendCredits()` are no-ops when `ENABLE_CREDITS` is off; otherwise validate balance and write transaction records.

### Database Schema

19 Prisma models covering: `User` (roles: CONSUMER, MAKER, SUPPLIER, ADMIN, AGENT), `MakerShop` with capabilities, `Listing` with pricing rules, `Order` / `OrderItem`, `FulfillmentJob`, `TrackingEvent`, `DesignFile` with DRM, `CreditAccount` / `CreditTransaction`, `ApiKey`, `DeliveryAssignment` (methods: COURIER, DRONE, PICKUP, AUTONOMOUS), `Supplier`.

Dev database is SQLite; production target is PostgreSQL 16.

### TypeScript Config

`tsconfig.base.json` at root is extended by every package. Strict mode, `ES2022` target, path aliases configured per-package.

## Phase Roadmap (from TODO.md)

| Phase | Status |
|---|---|
| 1 – Foundation (monorepo, DB schema, core packages) | Complete |
| 2 – Marketplace API (Hono + OpenAPI) | Not started |
| 3 – Order lifecycle + BullMQ job queue | Not started |
| 4 – Live tracking + WebSocket | Not started |
| 5 – Credits economy + Stripe | Not started |
| 6 – AI agent endpoints + webhooks | Not started |
| 7 – Production hardening | Not started |

Check `TODO.md` for the full task checklist before starting any new phase work.
