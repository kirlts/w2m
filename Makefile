# ============================================
# W2M - Makefile
# ============================================
# Comandos comunes para desarrollo y producción

.PHONY: dev prod build test clean logs shell stats help

# Variables
IMAGE_NAME := w2m
CONTAINER_NAME := w2m

# ─────────────────────────────────────────────────────────
# Desarrollo
# ─────────────────────────────────────────────────────────

## Iniciar en modo desarrollo con hot-reload (simula t3.small)
dev:
	@echo "🔧 Iniciando en modo desarrollo..."
	@chmod +x scripts/dev.sh
	@./scripts/dev.sh

## Iniciar en modo desarrollo (rebuild forzado)
dev-rebuild:
	@echo "🔧 Rebuild completo..."
	docker-compose build --no-cache
	docker-compose up

# ─────────────────────────────────────────────────────────
# Producción (testing local)
# ─────────────────────────────────────────────────────────

## Iniciar en modo producción (para testing local)
prod:
	@echo "🚀 Iniciando en modo producción..."
	docker-compose -f docker-compose.yml -f docker-compose.prod.yml up --build

## Build de imagen de producción
build:
	@echo "📦 Construyendo imagen de producción..."
	docker build --target production -t $(IMAGE_NAME):latest .

# ─────────────────────────────────────────────────────────
# Testing
# ─────────────────────────────────────────────────────────

## Ejecutar tests
test:
	@echo "🧪 Ejecutando tests..."
	npm run test

## Ejecutar tests con coverage
test-coverage:
	@echo "🧪 Tests con coverage..."
	npm run test:coverage

## Ejecutar linter
lint:
	@echo "🔍 Ejecutando linter..."
	npm run lint

## Verificar tipos TypeScript
typecheck:
	@echo "📝 Verificando tipos..."
	npm run typecheck

# ─────────────────────────────────────────────────────────
# Utilidades
# ─────────────────────────────────────────────────────────

## Ver logs del contenedor
logs:
	docker-compose logs -f $(CONTAINER_NAME)

## Abrir shell en el contenedor
shell:
	docker-compose exec $(CONTAINER_NAME) /bin/sh

## Ver estadísticas de recursos
stats:
	@echo "📊 Uso de recursos:"
	docker stats $(CONTAINER_NAME) --no-stream

## Limpiar contenedores, volúmenes e imágenes
clean:
	@echo "🧹 Limpiando..."
	docker-compose down -v --remove-orphans
	rm -rf dist/
	rm -rf data/logs/*
	@echo "✅ Limpieza completada"

## Limpiar TODO (incluyendo sesión de WhatsApp)
clean-all: clean
	@echo "⚠️  Eliminando sesión de WhatsApp..."
	rm -rf data/session/*
	@echo "✅ Limpieza total completada"

# ─────────────────────────────────────────────────────────
# Instalación
# ─────────────────────────────────────────────────────────

## Instalar dependencias
install:
	@echo "📦 Instalando dependencias..."
	npm ci

## Setup inicial del proyecto
setup: install
	@echo "📁 Creando directorios..."
	mkdir -p data/{session,vault,logs}
	@if [ ! -f .env ]; then \
		echo "📝 Creando .env..."; \
		cp env.example .env; \
	fi
	@echo "✅ Setup completado"
	@echo ""
	@echo "Próximos pasos:"
	@echo "  1. Edita .env con tus valores"
	@echo "  2. Ejecuta: make dev"

# ─────────────────────────────────────────────────────────
# Ayuda
# ─────────────────────────────────────────────────────────

## Mostrar esta ayuda
help:
	@echo "============================================"
	@echo "W2M - Comandos disponibles"
	@echo "============================================"
	@echo ""
	@grep -E '^## ' Makefile | sed 's/## //'
	@echo ""
	@echo "Uso: make <comando>"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'

# Default
.DEFAULT_GOAL := help

