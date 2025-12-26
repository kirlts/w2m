# ============================================
# W2M - WhatsApp to Markdown
# Multi-stage Dockerfile
# ============================================
# 
# Stages:
#   - base:        Imagen base con dependencias del sistema
#   - deps:        Instalación de dependencias npm
#   - development: Hot-reload para desarrollo local
#   - builder:     Compilación de TypeScript
#   - production:  Imagen final optimizada
#
# Uso:
#   Development:  docker build --target development -t w2m:dev .
#   Production:   docker build --target production -t w2m:latest .

# ============================================
# Stage: Base
# ============================================
FROM node:20-alpine AS base

WORKDIR /app

# Dependencias del sistema
# - git: para sincronización con repositorios
# - tini: init system para manejo correcto de señales
RUN apk add --no-cache \
    git \
    tini \
    && rm -rf /var/cache/apk/*

# Configurar git global
RUN git config --global --add safe.directory '*' && \
    git config --global user.email "w2m@localhost" && \
    git config --global user.name "W2M Bot"

# ============================================
# Stage: Dependencies
# ============================================
FROM base AS deps

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar TODAS las dependencias (incluyendo devDependencies)
# Usa npm ci si existe package-lock.json, sino npm install
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

# ============================================
# Stage: Development
# ============================================
FROM deps AS development

# Crear usuario no-root
RUN addgroup -g 1001 -S w2m && \
    adduser -u 1001 -S w2m -G w2m

# Crear directorios de datos
RUN mkdir -p /app/data/session /app/data/vault /app/data/logs && \
    chown -R w2m:w2m /app

# El código fuente se monta como volumen en docker-compose.override.yml
# Esto permite hot-reload sin rebuild

USER w2m

ENV NODE_ENV=development
ENV LOG_LEVEL=debug
ENV LOG_FORMAT=pretty

# Exponer puerto para Node.js Inspector (debugging)
EXPOSE 9229

# Hot-reload con tsx watch
CMD ["npx", "tsx", "watch", "src/index.ts"]

# ============================================
# Stage: Builder
# ============================================
FROM deps AS builder

# Copiar código fuente
COPY tsconfig.json ./
COPY src/ ./src/

# Compilar TypeScript
RUN npm run build

# Eliminar devDependencies para imagen más pequeña
RUN npm prune --production

# ============================================
# Stage: Production
# ============================================
FROM base AS production

# Crear usuario no-root por seguridad
RUN addgroup -g 1001 -S w2m && \
    adduser -u 1001 -S w2m -G w2m

# Copiar artefactos del builder
COPY --from=builder --chown=w2m:w2m /app/dist ./dist
COPY --from=builder --chown=w2m:w2m /app/node_modules ./node_modules
COPY --from=builder --chown=w2m:w2m /app/package.json ./

# Crear directorios de datos
RUN mkdir -p /app/data/session /app/data/vault /app/data/logs && \
    chown -R w2m:w2m /app/data

# Cambiar a usuario no-root
USER w2m

# Variables de entorno de producción
ENV NODE_ENV=production
ENV LOG_LEVEL=info
ENV LOG_FORMAT=json

# Health check
HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=40s \
    CMD node -e "process.exit(0)"

# Usar tini como init para manejo correcto de señales
ENTRYPOINT ["/sbin/tini", "--"]

# Comando de inicio con límite de memoria optimizado para t3.small
# --max-old-space-size=1024 deja ~500MB para el sistema
CMD ["node", "--max-old-space-size=1024", "dist/index.js"]
