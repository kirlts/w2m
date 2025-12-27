# ============================================
# W2M - WhatsApp to Markdown
# Multi-stage Dockerfile
# ============================================
# 
# Build stages:
#   - base:        Base image with system dependencies
#   - deps:        npm dependencies installation
#   - development: Hot-reload for local development
#   - builder:     TypeScript compilation
#   - production:  Optimized final image
#
# Usage:
#   Development:  docker build --target development -t w2m:dev .
#   Production:   docker build --target production -t w2m:latest .

# ============================================
# Stage: Base
# ============================================
FROM node:20-alpine AS base

WORKDIR /app

# System dependencies
# - git: for repository synchronization
# - tini: init system for proper signal handling
# - su-exec: to safely switch users
RUN apk add --no-cache \
    git \
    tini \
    su-exec \
    && rm -rf /var/cache/apk/*

# Configure git globally
RUN git config --global --add safe.directory '*' && \
    git config --global user.email "w2m@localhost" && \
    git config --global user.name "W2M Bot"

# ============================================
# Stage: Dependencies
# ============================================
FROM base AS deps

# Copy dependency files
COPY package.json ./
COPY package-lock.json* ./

# Install ALL dependencies (including devDependencies and optionalDependencies)
# We use npm install instead of npm ci because optionalDependencies (like sharp)
# have platform-specific dependencies that npm ci doesn't handle well
RUN npm install

# ============================================
# Stage: Development
# ============================================
FROM deps AS development

# Create non-root user
RUN addgroup -g 1001 -S w2m && \
    adduser -u 1001 -S w2m -G w2m

# Create data directories
RUN mkdir -p /app/data/session /app/data/vault /app/data/logs && \
    chown -R w2m:w2m /app

# Source code is mounted as volume in docker-compose.yml (dev profile)
# This allows hot-reload without rebuild

USER w2m

ENV NODE_ENV=development
ENV LOG_LEVEL=debug
ENV LOG_FORMAT=pretty

# Expose port for Node.js Inspector (debugging)
EXPOSE 9229

# Hot-reload with tsx watch
CMD ["npx", "tsx", "watch", "src/index.ts"]

# ============================================
# Stage: Builder
# ============================================
FROM deps AS builder

# Copy source code
COPY tsconfig.json ./
COPY src/ ./src/

# Compile TypeScript (needs all dependencies, including optionalDependencies)
RUN npm run build

# Remove devDependencies but keep dependencies and optionalDependencies
# npm prune --production removes only devDependencies
# and automatically keeps dependencies and optionalDependencies
RUN npm prune --production

# ============================================
# Stage: Production
# ============================================
FROM base AS production

# Create non-root user for security
RUN addgroup -g 1001 -S w2m && \
    adduser -u 1001 -S w2m -G w2m

# Copy artifacts from builder
COPY --from=builder --chown=w2m:w2m /app/dist ./dist
COPY --from=builder --chown=w2m:w2m /app/node_modules ./node_modules
COPY --from=builder --chown=w2m:w2m /app/package.json ./

# Create data directories
RUN mkdir -p /app/data/session /app/data/vault /app/data/logs && \
    chown -R w2m:w2m /app/data

# Copy entrypoint script
COPY scripts/entrypoint.sh /app/scripts/entrypoint.sh
RUN chmod +x /app/scripts/entrypoint.sh

# Production environment variables
ENV NODE_ENV=production
ENV LOG_LEVEL=info
ENV LOG_FORMAT=json

# Health check
HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=40s \
    CMD node -e "process.exit(0)"

# DO NOT switch user here - entrypoint.sh will do it
# Keep as root so it can adjust permissions

# Use tini as init for proper signal handling
ENTRYPOINT ["/sbin/tini", "--"]

# Entrypoint script that adjusts permissions and switches to w2m user
CMD ["/app/scripts/entrypoint.sh"]
