# ============================================
# W2M - Makefile
# ============================================
# Common commands for development and production

.PHONY: dev prod build test clean logs shell stats help

# Variables
IMAGE_NAME := w2m
CONTAINER_NAME := w2m

# ─────────────────────────────────────────────────────────
# Development
# ─────────────────────────────────────────────────────────

## Start in development mode with hot-reload (simulates t3.small)
dev:
	@echo "🔧 Starting in development mode..."
	@chmod +x scripts/dev.sh
	@./scripts/dev.sh

## Start in development mode (force rebuild)
dev-rebuild:
	@echo "🔧 Full rebuild..."
	docker-compose build --no-cache
	docker-compose up

# ─────────────────────────────────────────────────────────
# Production (local testing)
# ─────────────────────────────────────────────────────────

## Start in production mode (for local testing)
prod:
	@echo "🚀 Starting in production mode..."
	BUILD_TARGET=production docker-compose up --build

## Build production image
build:
	@echo "📦 Building production image..."
	docker build --target production -t $(IMAGE_NAME):latest .

# ─────────────────────────────────────────────────────────
# Testing
# ─────────────────────────────────────────────────────────

## Run tests
test:
	@echo "🧪 Running tests..."
	npm run test

## Run tests with coverage
test-coverage:
	@echo "🧪 Tests with coverage..."
	npm run test:coverage

## Run linter
lint:
	@echo "🔍 Running linter..."
	npm run lint

## Verify TypeScript types
typecheck:
	@echo "📝 Verifying types..."
	npm run typecheck

# ─────────────────────────────────────────────────────────
# Utilities
# ─────────────────────────────────────────────────────────

## View container logs
logs:
	docker-compose logs -f $(CONTAINER_NAME)

## Open shell in container
shell:
	docker-compose exec $(CONTAINER_NAME) /bin/sh

## View resource statistics
stats:
	@echo "📊 Resource usage:"
	docker stats $(CONTAINER_NAME) --no-stream

## Clean containers, volumes and images
clean:
	@echo "🧹 Cleaning..."
	docker-compose down -v --remove-orphans
	rm -rf dist/
	rm -rf data/logs/*
	@echo "✅ Cleanup completed"

## Clean EVERYTHING (including WhatsApp session)
clean-all: clean
	@echo "⚠️  Removing WhatsApp session..."
	rm -rf data/session/*
	@echo "✅ Full cleanup completed"

# ─────────────────────────────────────────────────────────
# Installation
# ─────────────────────────────────────────────────────────

## Install dependencies
install:
	@echo "📦 Installing dependencies..."
	npm ci

## Initial project setup
setup: install
	@echo "📁 Creating directories..."
	mkdir -p data/{session,vault,logs}
	@if [ ! -f .env ]; then \
		echo "📝 Creating .env..."; \
		cp env.example .env; \
	fi
	@echo "✅ Setup completed"
	@echo ""
	@echo "Next steps:"
	@echo "  1. Edit .env with your values"
	@echo "  2. Run: make dev"

# ─────────────────────────────────────────────────────────
# Help
# ─────────────────────────────────────────────────────────

## Show this help
help:
	@echo "============================================"
	@echo "W2M - Available Commands"
	@echo "============================================"
	@echo ""
	@grep -E '^## ' Makefile | sed 's/## //'
	@echo ""
	@echo "Usage: make <command>"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'

# Default
.DEFAULT_GOAL := help
