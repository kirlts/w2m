#!/bin/bash
# ============================================
# W2M - Script de Desarrollo Local
# ============================================
# Inicia W2M en modo desarrollo con hot-reload
# Simula el entorno de producción (t3.small: 2 vCPU, 2GB RAM)
#
# Uso:
#   ./scripts/dev.sh

set -e

echo "============================================"
echo "🔧 W2M - Modo Desarrollo"
echo "============================================"
echo ""
echo "📊 Simulando entorno t3.small:"
echo "   - CPU: 2 cores"
echo "   - RAM: 2 GB"
echo ""

# ─────────────────────────────────────────────────────────
# Verificar Docker
# ─────────────────────────────────────────────────────────
if ! docker info > /dev/null 2>&1; then
    echo "❌ Error: Docker no está corriendo"
    echo "   Inicia Docker Desktop o el servicio de Docker"
    exit 1
fi

echo "✅ Docker está corriendo"

# ─────────────────────────────────────────────────────────
# Crear directorios de datos
# ─────────────────────────────────────────────────────────
echo "📁 Verificando directorios..."
mkdir -p data/{session,vault,logs}

# ─────────────────────────────────────────────────────────
# Verificar .env
# ─────────────────────────────────────────────────────────
if [ ! -f .env ]; then
    echo "📝 Creando .env desde env.example..."
    cp env.example .env
    echo "   ⚠️  Recuerda editar .env con tus valores"
fi

# ─────────────────────────────────────────────────────────
# Iniciar
# ─────────────────────────────────────────────────────────
echo ""
echo "🚀 Iniciando W2M..."
echo "   (docker-compose.override.yml se aplica automáticamente)"
echo ""
echo "📌 Comandos útiles:"
echo "   - Ver logs:    docker-compose logs -f w2m"
echo "   - Parar:       docker-compose down"
echo "   - Shell:       docker-compose exec w2m sh"
echo "   - Stats:       docker stats w2m"
echo ""
echo "🔌 Debugger disponible en: localhost:9229"
echo ""
echo "============================================"
echo ""

# Iniciar con build (por si hay cambios en Dockerfile)
docker-compose up --build

