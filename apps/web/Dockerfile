FROM node:20-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# ── Builder ───────────────────────────────────────────────────────────────────
FROM base AS builder
WORKDIR /repo

# NEXT_PUBLIC_ vars are inlined at build time — pass the API URL here
ARG NEXT_PUBLIC_API_URL=http://localhost/api
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm build --filter @tpt/web...

# ── Runner ────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
# PORT for @hono/node-server compatibility; Next.js reads this too
ENV PORT=3000

# Standalone output mirrors the monorepo root (see outputFileTracingRoot in next.config.ts)
COPY --from=builder /repo/apps/web/.next/standalone ./
COPY --from=builder /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /repo/apps/web/public ./apps/web/public

EXPOSE 3000

CMD ["node", "apps/web/server.js"]
