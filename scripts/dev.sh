#!/bin/bash
# ============================================
# W2M - Local Development Script
# ============================================
# Starts W2M in development mode with hot-reload
# Simulates production environment (t3.small: 2 vCPU, 2GB RAM)
#
# Usage:
#   ./scripts/dev.sh

set -e

echo "============================================"
echo "🔧 W2M - Development Mode"
echo "============================================"
echo ""
echo "📊 Simulating t3.small environment:"
echo "   - CPU: 2 cores"
echo "   - RAM: 2 GB"
echo ""

# Check Docker
if ! docker info > /dev/null 2>&1; then
    echo "❌ Error: Docker is not running"
    echo "   Start Docker Desktop or Docker service"
    exit 1
fi

echo "✅ Docker is running"

# Create data directories
echo "📁 Checking directories..."
mkdir -p data/{session,vault,logs}

# Check .env
if [ ! -f .env ]; then
    echo "📝 Creating .env from env.example..."
    cp env.example .env
    echo "   ⚠️  Remember to edit .env with your values"
fi

# Start with dev profile
echo ""
echo "🚀 Starting W2M in development mode..."
echo ""
echo "📌 Useful commands:"
echo "   - View logs:    docker-compose logs -f w2m"
echo "   - Stop:         docker-compose down"
echo "   - Shell:        docker-compose exec w2m sh"
echo "   - Stats:        docker stats w2m"
echo ""
echo "🔌 Debugger available at: localhost:9229"
echo ""
echo "============================================"
echo ""

# Start in development mode (builds development target with hot-reload)
BUILD_TARGET=development NODE_ENV=development LOG_LEVEL=debug LOG_FORMAT=pretty \
  docker-compose up --build
