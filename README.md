# TPT Production

**Fully automated production platform** — 3D printing, robotics, and AI agents coordinate to fulfil orders end-to-end with minimal human involvement.

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)](https://www.typescriptlang.org/)
[![pnpm](https://img.shields.io/badge/pnpm-workspace-orange)](https://pnpm.io/)

---

## Overview

TPT Production connects **consumers** who want custom manufactured goods with **maker shops** (3D printers, CNC machines, robotics cells) via an automated platform. Orders are routed, produced, and tracked without human dispatch.

| Role | What they do |
|---|---|
| **Consumer** | Browse catalog, upload designs, place orders, track in real time |
| **Maker** | Register shop + capabilities, receive jobs, accept/complete via API or dashboard |
| **Supplier** | External material/component vendor integrated via API config |
| **AI Agent** | Any of the above via API key — auto-routing, auto-accepting, auto-completing |
| **Admin** | Platform oversight — orders, routing decisions, payments, royalties |

---

## Tech Stack

| Layer | Technology |
|---|---|
| API | [Hono](https://hono.dev/) + [@hono/zod-openapi](https://github.com/honojs/middleware/tree/main/packages/zod-openapi) |
| Job Queue | [BullMQ](https://bullmq.io/) on Redis 7 |
| Real-time | [Socket.io](https://socket.io/) (order status push) |
| Database | [Prisma](https://www.prisma.io/) ORM — SQLite (dev) / PostgreSQL 16 (prod) |
| Payments | [Stripe](https://stripe.com/) checkout + webhooks |
| Storage | Cloudflare R2 (or local filesystem) |
| Frontend | [Next.js 15](https://nextjs.org/) App Router + [shadcn/ui](https://ui.shadcn.com/) |
| Monorepo | [Turborepo](https://turbo.build/) + [pnpm](https://pnpm.io/) workspaces |
| Containers | Docker + nginx reverse proxy |

---

## Repository Layout

```
tpt-production/
├── apps/
│   ├── api/          # Hono REST API + OpenAPI + BullMQ workers
│   ├── web/          # Next.js 15 consumer marketplace
│   └── admin/        # Next.js 15 maker/admin portal
├── packages/
│   ├── db/           # Prisma schema, migrations, generated client
│   ├── types/        # Shared TypeScript enums and API types
│   ├── core/         # Routing engine, pricing, credits logic
│   └── ui/           # Shared shadcn/ui components
├── nginx/            # nginx.conf for production reverse proxy
├── docs/             # env.md, deployment.md
├── docker-compose.yml          # Dev infrastructure (Postgres + Redis)
└── docker-compose.prod.yml     # Full production stack
```

---

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm 9+
- Docker (for Postgres + Redis)

### 1. Clone & install

```bash
git clone https://github.com/PhillipT1/tpt-production.git
cd tpt-production
pnpm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env — at minimum set ADMIN_API_TOKEN and ADMIN_SECRET
```

### 3. Start infrastructure

```bash
docker compose up -d   # PostgreSQL 16 on :5432, Redis 7 on :6379
```

### 4. Run database migrations

```bash
cd packages/db
pnpm migrate:dev
cd ../..
```

### 5. Start all apps

```bash
pnpm dev
```

| Service | URL |
|---|---|
| API + Swagger | http://localhost:8787 / http://localhost:8787/docs |
| Consumer Web | http://localhost:3000 |
| Admin Portal | http://localhost:3001 |

---

## Feature Flags

All flags default to `false` except `ENABLE_FREE_ECONOMY=true`. Set in `.env`:

| Flag | What it enables |
|---|---|
| `ENABLE_FREE_ECONOMY` | All prices resolve to 0; orders route without payment |
| `ENABLE_CREDITS` | Credit accounts, earn/spend/refund ledger |
| `ENABLE_PAYMENTS` | Stripe checkout + webhook processing |
| `ENABLE_DRM` | Design file DRM + royalty calculation on job completion |
| `ENABLE_PRICE_DECAY` | Linear/exponential/step price decay schedules |
| `ENABLE_AI_AGENTS` | API key auth, OpenAPI spec endpoint, agent webhooks |

---

## API

The Hono API exposes ~50 endpoints documented via OpenAPI. Once running:

- **Swagger UI**: http://localhost:8787/docs
- **OpenAPI JSON**: http://localhost:8787/openapi.json (agent-consumable)

### Authentication

| Method | Header | Used for |
|---|---|---|
| Admin token | `Authorization: Bearer <ADMIN_API_TOKEN>` or `X-API-Key` | Admin endpoints |
| API key | `X-API-Key: <key>` | Agent endpoints (scoped) |

---

## Production Deployment

See [docs/deployment.md](docs/deployment.md) for the full guide. Quick reference:

```bash
# 1. Create .env with all production secrets
# 2. Switch DATABASE_URL to PostgreSQL connection string
# 3. Build and start
docker compose -f docker-compose.prod.yml up -d --build
```

The production compose file starts: PostgreSQL, Redis, a one-shot migration runner, the API, web, admin, and nginx (ports 80 + 3001).

> **Database**: The schema defaults to SQLite for development. Before production deploy, set `DATABASE_URL` to a PostgreSQL connection string. See [docs/deployment.md](docs/deployment.md).

---

## Development Commands

Run from repo root:

```bash
pnpm dev          # Turborepo watch mode across all packages
pnpm build        # Build all packages (cached)
pnpm lint         # ESLint across workspace
pnpm type-check   # TypeScript strict check
pnpm format       # Prettier (100-char, double quotes, 2-space)
```

Database (from `packages/db`):

```bash
pnpm migrate:dev  # Apply Prisma migrations
pnpm studio       # Open Prisma Studio
```

Tests:

```bash
pnpm --filter @tpt/core test       # Unit tests (routing, pricing)
pnpm --filter @tpt/api test        # Integration tests (order lifecycle)
```

---

## Architecture Highlights

### Routing Engine

`packages/core/src/routing/` — `routeOrder()` scores maker candidates using:
- **Geo distance** (Haversine formula)
- **Cost** (listing price vs. shop cost estimate)
- **Capacity** (available job slots)
- **Capabilities** (material + machine type match)

Weights are env-configurable. Accepts a `customScorer` plugin for AI integration.

### Pricing Engine

`packages/core/src/pricing/` — `resolvePrice()` handles:
- `FIXED` — static price
- `COST_PLUS` — base cost + margin
- `FREE` — zero (respects `ENABLE_FREE_ECONOMY`)
- `DECAY` — linear, exponential, or step price decay over time

### Order Lifecycle

```
Consumer places order
  → BullMQ routing job queued
  → Routing engine scores shops → FulfillmentJob created (PENDING)
  → Maker accepts (IN_PRODUCTION)
  → Maker completes → DeliveryAssignment created (IN_TRANSIT)
  → Carrier/agent pushes TrackingEvents → Socket.io broadcasts to consumer
  → DELIVERED
```

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). All contributions require a signed-off commit (`git commit -s`).

---

## Security

To report a vulnerability, see [SECURITY.md](SECURITY.md).

---

## License

Apache License 2.0 — see [LICENSE](LICENSE).

Copyright 2026 TPT Solutions
