# Environment Variables

All variables are consumed by `apps/api` unless otherwise noted. Copy `.env.example` and fill in real values before starting.

---

## Required in production

| Variable | Service | Description |
|---|---|---|
| `POSTGRES_PASSWORD` | compose | PostgreSQL password. No default — must be set. |
| `REDIS_PASSWORD` | compose | Redis password. No default — must be set. |
| `ADMIN_API_TOKEN` | api | Secret token for admin-only endpoints and DRM access. Min 32 chars recommended. |
| `ADMIN_SECRET` | admin | Auth secret for the admin Next.js app. |

---

## Database

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `file:../../packages/db/prisma/dev.db` (dev) | Prisma connection string. In production use `postgresql://user:pass@host:5432/tpt`. |
| `POSTGRES_USER` | `postgres` | PostgreSQL username (compose only). |
| `POSTGRES_DB` | `tpt` | PostgreSQL database name (compose only). |

---

## Redis / BullMQ

| Variable | Default | Description |
|---|---|---|
| `REDIS_URL` | `redis://localhost:6379` | Redis connection URL. In production include the password: `redis://:password@redis:6379`. |

---

## API server

| Variable | Default | Description |
|---|---|---|
| `PORT` | `8787` | Port the Hono server listens on. |
| `NODE_ENV` | — | Set to `production` to enable HSTS and production-only Prisma logging. |
| `LOG_LEVEL` | `info` | Pino log level: `trace`, `debug`, `info`, `warn`, `error`, `fatal`. |
| `ALLOWED_ORIGINS` | *(open in dev)* | Comma-separated list of allowed CORS origins, e.g. `https://tpt.example.com,https://admin.tpt.example.com`. When unset in development, all origins are allowed. |

---

## File storage

The API supports two storage backends. Set the R2 variables to use Cloudflare R2; leave them unset to fall back to local disk.

| Variable | Default | Description |
|---|---|---|
| `LOCAL_UPLOAD_DIR` | `apps/api/uploads` | Absolute or repo-relative path for local file storage. |
| `LOCAL_UPLOAD_BASE_URL` | `http://localhost:<PORT>` | Base URL returned in upload responses when using local storage. |
| `R2_ENDPOINT` | — | Cloudflare R2 S3-compatible endpoint URL. |
| `R2_BUCKET_NAME` | — | R2 bucket name. |
| `R2_ACCESS_KEY_ID` | — | R2 access key ID. |
| `R2_SECRET_ACCESS_KEY` | — | R2 secret access key. |

---

## Payments (Phase 5)

Leave unset until Stripe integration is enabled via `ENABLE_PAYMENTS=true`.

| Variable | Default | Description |
|---|---|---|
| `STRIPE_SECRET_KEY` | — | Stripe secret API key (`sk_live_…` or `sk_test_…`). |
| `STRIPE_WEBHOOK_SECRET` | — | Stripe webhook signing secret (`whsec_…`). |

---

## Feature flags

All flags default to `false` except `ENABLE_FREE_ECONOMY`. Set to `true` to enable.

| Variable | Default | Description |
|---|---|---|
| `ENABLE_FREE_ECONOMY` | `true` | Skip payment gating — orders go straight to routing. |
| `ENABLE_CREDITS` | `false` | Enable credit account earn/spend on orders and fulfillment. |
| `ENABLE_DRM` | `false` | Enable design royalty calculation on job completion. |
| `ENABLE_PAYMENTS` | `false` | Enable Stripe payment intent creation on order placement. |
| `ENABLE_PRICE_DECAY` | `false` | Enable time-based price decay for `DECAY` listing type. |
| `ENABLE_AI_AGENTS` | `false` | Enable AI agent webhook endpoints. |

---

## Frontend apps

These are embedded into the Next.js bundle at **build time** via `ARG` in the Dockerfile. Changing them requires a rebuild.

| Variable | App | Default | Description |
|---|---|---|---|
| `NEXT_PUBLIC_API_URL` | web, admin | `http://localhost/api` | Public-facing API base URL. When served behind nginx on port 80, use the `/api` path prefix (nginx strips it before forwarding to the API service). |
| `ADMIN_SECRET` | admin | — | Runtime secret read server-side by the admin app for authorisation. |

---

## Notes

**`NEXT_PUBLIC_API_URL` with nginx:** The compose setup routes `http://your-host/api/*` → `api:8787/*` (nginx strips the `/api` prefix). So `NEXT_PUBLIC_API_URL` should be `http://your-host/api` with no trailing slash.

**SQLite vs PostgreSQL:** The Prisma schema defaults to `sqlite` for local development. Before deploying to production, update `packages/db/prisma/schema.prisma`:
```
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```
Then regenerate and run migrations — see [deployment.md](deployment.md).
