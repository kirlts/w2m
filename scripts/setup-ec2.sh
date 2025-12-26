#!/bin/bash
# ============================================
# W2M - Setup Script para EC2 t3.small
# ============================================
# Ejecutar UNA VEZ en una instancia EC2 nueva
# 
# Uso:
#   curl -sSL https://raw.githubusercontent.com/TU_USUARIO/w2m/main/scripts/setup-ec2.sh | bash
#   
# O descargarlo y ejecutar:
#   chmod +x setup-ec2.sh
#   ./setup-ec2.sh

set -e

echo "============================================"
echo "🚀 W2M - Configurando EC2 t3.small"
echo "============================================"
echo ""

# ─────────────────────────────────────────────────────────
# 1. Actualizar sistema
# ─────────────────────────────────────────────────────────
echo "📦 Actualizando sistema..."
sudo apt update && sudo apt upgrade -y

# ─────────────────────────────────────────────────────────
# 2. Instalar Docker
# ─────────────────────────────────────────────────────────
echo "🐳 Instalando Docker..."
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com | sh
    sudo usermod -aG docker $USER
    echo "   ✅ Docker instalado"
else
    echo "   ℹ️  Docker ya está instalado"
fi

# ─────────────────────────────────────────────────────────
# 3. Instalar Docker Compose
# ─────────────────────────────────────────────────────────
echo "🐳 Instalando Docker Compose..."
if ! command -v docker-compose &> /dev/null; then
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
    echo "   ✅ Docker Compose instalado"
else
    echo "   ℹ️  Docker Compose ya está instalado"
fi

# ─────────────────────────────────────────────────────────
# 4. Configurar Swap (2GB para t3.small)
# ─────────────────────────────────────────────────────────
echo "💾 Configurando Swap (2GB)..."
if [ ! -f /swapfile ]; then
    sudo fallocate -l 2G /swapfile
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
    sudo swapon /swapfile
    echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
    echo 'vm.swappiness=10' | sudo tee -a /etc/sysctl.conf
    sudo sysctl -p
    echo "   ✅ Swap de 2GB configurado"
else
    echo "   ℹ️  Swap ya está configurado"
fi

# ─────────────────────────────────────────────────────────
# 5. Crear estructura de directorios
# ─────────────────────────────────────────────────────────
echo "📁 Creando directorios..."
mkdir -p ~/w2m/data/{session,vault,logs}
cd ~/w2m

# ─────────────────────────────────────────────────────────
# 6. Descargar docker-compose.prod.yml
# ─────────────────────────────────────────────────────────
echo "📥 Descargando configuración de producción..."
cat > docker-compose.yml << 'EOF'
version: '3.8'

services:
  w2m:
    image: ghcr.io/${GITHUB_REPOSITORY:-tu-usuario/w2m}:latest
    container_name: w2m
    restart: unless-stopped
    deploy:
      resources:
        limits:
          memory: 1536M
        reservations:
          memory: 512M
    env_file:
      - .env
    environment:
      - NODE_ENV=production
      - NODE_OPTIONS=--max-old-space-size=1024
      - TZ=UTC
    volumes:
      - ./data/session:/app/data/session
      - ./data/vault:/app/data/vault
      - ./data/logs:/app/data/logs
    healthcheck:
      test: ["CMD", "node", "-e", "process.exit(0)"]
      interval: 60s
      timeout: 10s
      retries: 3
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "5"
EOF

# ─────────────────────────────────────────────────────────
# 7. Crear archivo .env de ejemplo
# ─────────────────────────────────────────────────────────
echo "📝 Creando archivo .env..."
cat > .env << 'EOF'
# ============================================
# W2M - Configuración de Producción
# ============================================

# WhatsApp
WA_SESSION_PATH=./data/session
WA_ALLOWED_GROUPS=
WA_QR_TIMEOUT=60000
WA_RECONNECT_INTERVAL=5000

# Vault
VAULT_PATH=./data/vault
VAULT_DATE_FORMAT=yyyy-MM-dd
VAULT_ENABLE_FRONTMATTER=true

# Git Sync
GIT_ENABLED=true
GIT_REMOTE=origin
GIT_BRANCH=main
GIT_COMMIT_PREFIX=[W2M]
GIT_SYNC_INTERVAL=300000

# Feedback
FEEDBACK_CONFIRMATIONS=true
FEEDBACK_ERRORS=true
FEEDBACK_RATE_LIMIT=1000

# Logging
LOG_LEVEL=info
LOG_FORMAT=json
EOF

echo ""
echo "============================================"
echo "✅ EC2 configurado exitosamente!"
echo "============================================"
echo ""
echo "📋 Próximos pasos:"
echo ""
echo "1. IMPORTANTE: Cierra sesión y vuelve a entrar"
echo "   (para que el grupo 'docker' tome efecto)"
echo "   $ exit"
echo "   $ ssh tu-usuario@tu-ec2"
echo ""
echo "2. Edita el archivo .env con tus valores:"
echo "   $ nano ~/w2m/.env"
echo ""
echo "3. Configura Git para el vault (si usas Git sync):"
echo "   $ git config --global user.email 'w2m@tu-dominio.com'"
echo "   $ git config --global user.name 'W2M Bot'"
echo ""
echo "4. Inicia W2M:"
echo "   $ cd ~/w2m"
echo "   $ docker-compose up -d"
echo ""
echo "5. Escanea el QR:"
echo "   $ docker-compose logs -f w2m"
echo ""
echo "============================================"

