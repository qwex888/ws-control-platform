# ============================================================
# Multi-stage Dockerfile for ws-control-platform
# Produces a single image: nginx serves the frontend SPA and
# reverse-proxies /api, /auth, /ws to the Node.js gateway.
# ADB is pre-installed inside the image.
# ============================================================

# ---- Stage 1: Install dependencies & build frontend --------
FROM node:22-slim AS builder

RUN corepack enable && corepack prepare pnpm@10.0.0 --activate

WORKDIR /app

# Copy workspace root manifests first for layer caching
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./

# Copy package.json for each workspace package
COPY packages/core/package.json packages/core/
COPY packages/ui-tokens/package.json packages/ui-tokens/
COPY apps/web/package.json apps/web/
COPY services/gateway/package.json services/gateway/

RUN pnpm install --frozen-lockfile

# Copy all source files
COPY packages/ packages/
COPY apps/web/ apps/web/
COPY services/gateway/ services/gateway/

# Build frontend SPA
RUN pnpm --filter @wsctl/web build

# Re-install with prod-only deps for runtime image
RUN rm -rf node_modules packages/*/node_modules apps/*/node_modules services/*/node_modules && \
    pnpm install --frozen-lockfile --prod

# ---- Stage 2: Production image -----------------------------
FROM node:22-slim

# --- Install ADB + nginx + tini ---
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      adb \
      nginx \
      tini \
    && rm -rf /var/lib/apt/lists/*

# --- Install tsx globally (use npm to avoid pnpm global-bin-dir issue) ---
RUN npm install -g tsx

WORKDIR /app

# Copy workspace structure with prod deps only
COPY --from=builder /app/package.json /app/pnpm-workspace.yaml /app/pnpm-lock.yaml /app/tsconfig.base.json ./
COPY --from=builder /app/node_modules/ ./node_modules/

# Copy @wsctl/core (raw TS, needed at runtime by gateway via tsx)
COPY --from=builder /app/packages/core/ ./packages/core/

# Copy gateway source + vendor + prod deps
COPY --from=builder /app/services/gateway/package.json ./services/gateway/
COPY --from=builder /app/services/gateway/node_modules/ ./services/gateway/node_modules/
COPY --from=builder /app/services/gateway/src/ ./services/gateway/src/
COPY --from=builder /app/services/gateway/vendor/ ./services/gateway/vendor/
COPY --from=builder /app/services/gateway/tsconfig.json ./services/gateway/

# Copy built frontend
COPY --from=builder /app/apps/web/dist/ /usr/share/nginx/html/

# Copy nginx config & entrypoint
COPY docker/nginx.conf /etc/nginx/nginx.conf
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Persistent volumes: app data + ADB keys
VOLUME ["/app/data", "/root/.android"]

EXPOSE 28081

ENV NODE_ENV=production
ENV PORT=33721
ENV ADB_HOST=127.0.0.1
ENV ADB_PORT=5037

ENTRYPOINT ["tini", "--"]
CMD ["/entrypoint.sh"]
