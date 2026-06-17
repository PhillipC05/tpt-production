FROM node:20-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# ── Builder ───────────────────────────────────────────────────────────────────
FROM base AS builder
WORKDIR /repo

COPY . .
RUN pnpm install --frozen-lockfile
# Build all workspace packages in dependency order via Turborepo
RUN pnpm build
# Create a production-only deploy bundle (resolves workspace:* deps)
RUN pnpm --filter @tpt/api deploy --prod /deploy

# ── Runner ────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Copy deployed node_modules (includes resolved workspace packages)
COPY --from=builder /deploy/node_modules ./node_modules
# Copy compiled API output
COPY --from=builder /repo/apps/api/dist ./dist

EXPOSE 8787

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:8787/health || exit 1

CMD ["node", "dist/index.js"]
