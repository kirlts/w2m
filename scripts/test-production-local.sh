#!/bin/bash
#
# W2M - Test Production Build Locally
#
# This script allows you to test the production build locally,
# simulating exactly what will run on EC2 after CI/CD deployment.
#
# Usage:
#   ./scripts/test-production-local.sh
#
# The script will:
#   1. Check/create .env file from env.example
#   2. Create required data directories
#   3. Build the production Docker image
#   4. Start the container with the same configuration as production
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Testing W2M locally (production mode)${NC}"
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠️  .env file not found. Creating from env.example...${NC}"
    cp env.example .env
    echo -e "${GREEN}✅ .env file created.${NC}"
    echo -e "${YELLOW}   Please review and adjust values in .env as needed.${NC}"
    echo ""
fi

# Create data directories if they don't exist
echo "📁 Creating data directories..."
mkdir -p data/session data/vault data/logs
echo -e "${GREEN}✅ Data directories ready${NC}"
echo ""

# Detect docker compose command
if docker compose version &> /dev/null 2>&1; then
    DOCKER_COMPOSE="docker compose"
elif command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE="docker-compose"
else
    echo -e "${RED}❌ Error: docker compose is not available${NC}"
    echo "   Please install Docker Compose or Docker Desktop"
    exit 1
fi

echo -e "${BLUE}🔧 Using: $DOCKER_COMPOSE${NC}"
echo ""

# Start with prod profile (builds production target locally)
echo -e "${BLUE}🐳 Starting container in production mode (local build)...${NC}"
echo ""
echo -e "${YELLOW}💡 Tip: Use Ctrl+C to stop the container${NC}"
echo ""

# Build and run locally in production mode
BUILD_TARGET=production NODE_ENV=production \
  $DOCKER_COMPOSE up --build
