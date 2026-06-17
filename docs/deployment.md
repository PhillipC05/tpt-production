# Deployment Guide

## Overview

TPT uses a pnpm + Turborepo monorepo. Each app is built into its own Docker image from the repo root as the build context.

```
nginx (port 80 / 3001)
├── web   (Next.js, port 3000)
├── admin (Next.js, port 3001)
└── /api/ → api (Hono, port 8787)
             ├── postgres:5432
             └── redis:6379
```

---

## First-time production setup

### 1. Switch Prisma to PostgreSQL

The schema ships with `provider = "sqlite"` for local development. Before deploying, update `packages/db/prisma/schema.prisma`:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

Then regenerate the Prisma client and create the initial migration:

```bash
# from repo root
DATABASE_URL="postgresql://postgres:yourpassword@localhost:5432/tpt" \
  pnpm --filter @tpt/db exec prisma migrate dev --name init
```

Commit the generated migration files in `packages/db/prisma/migrations/`.

### 2. Create `.env.prod`

Copy the example and fill in all required values:

```bash
cp .env.example .env.prod
```

Required variables (no defaults):
- `POSTGRES_PASSWORD`
- `REDIS_PASSWORD`
- `ADMIN_API_TOKEN`
- `ADMIN_SECRET`

See [env.md](env.md) for the full reference.

### 3. Build and start

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

The `migrate` service runs `prisma migrate deploy` before the API starts. It exits after completion — this is expected.

---

## Database migrations

### Applying migrations in production

Migrations run automatically via the `migrate` service in `docker-compose.prod.yml` on every `docker compose up`. The service exits with code 0 on success and the API waits for it via `depends_on: condition: service_completed_successfully`.

To run migrations manually:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod run --rm migrate
```

### Creating a new migration (development)

```bash
# From packages/db
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/tpt" \
  pnpm exec prisma migrate dev --name describe_your_change
```

Turborepo will rebuild the Prisma client automatically on the next `pnpm build`.

### Rolling back

Prisma does not support automatic rollbacks. To revert:

1. Identify the last good migration in `packages/db/prisma/migrations/`.
2. Connect to the database and manually reverse the schema change.
3. Delete the unwanted migration directory.
4. Run `prisma migrate resolve --rolled-back <migration_name>` to mark it as rolled back in `_prisma_migrations`.

---

## Rebuilding after code changes

Rebuild only the changed service:

```bash
# Rebuild and restart just the API
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build api

# Rebuild web and admin (NEXT_PUBLIC_API_URL is baked in at build time)
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build web admin
```

---

## File uploads

When `R2_*` environment variables are not set, the API stores uploaded design files on disk at `/app/uploads` inside the container, backed by the `api_uploads` Docker volume.

To migrate to Cloudflare R2:
1. Set `R2_ENDPOINT`, `R2_BUCKET_NAME`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` in `.env.prod`.
2. Copy existing uploads from the volume to R2 (use `rclone` or `aws s3 cp`).
3. Rebuild and restart the API.

---

## Health checks

| Endpoint | What it checks |
|---|---|
| `GET /health` | PostgreSQL `SELECT 1` + Redis TCP connection |

nginx doesn't expose the health endpoint externally (it's at `http://api:8787/health` inside the compose network). To check from the host:

```bash
docker compose -f docker-compose.prod.yml exec api wget -qO- http://localhost:8787/health
```

---

## Updating to a new release

```bash
git pull
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

The `migrate` service will apply any new migrations before the API restarts.

---

## SSL / TLS

The nginx config ships without TLS. For production, use one of:

- **Certbot + Let's Encrypt:** Mount certificates into the nginx container and update `nginx/nginx.conf` to add `listen 443 ssl` server blocks.
- **Cloudflare Tunnel:** Run `cloudflared` as a sidecar — no certificate management needed.
- **Load balancer TLS termination:** Terminate TLS at the load balancer (AWS ALB, GCP LB) and forward plain HTTP to nginx port 80.
