#!/bin/sh
# Script para ajustar permisos de directorios montados
# Se ejecuta al iniciar el contenedor como root (setuid)

# Si estamos ejecutando como root (por setuid), ajustar permisos
if [ "$(id -u)" = "0" ]; then
    # Ajustar permisos de directorios de datos para que w2m pueda escribir
    chmod -R 777 /app/data 2>/dev/null || true
    chown -R 1001:1001 /app/data 2>/dev/null || true
fi

# Verificar que el directorio session es escribible
if [ -d /app/data/session ]; then
    # Intentar crear un archivo de prueba
    touch /app/data/session/.test 2>/dev/null && rm -f /app/data/session/.test || {
        echo "⚠️  Warning: No se pueden escribir en /app/data/session" >&2
        echo "   Ejecuta en el host: chmod -R 777 data/session" >&2
    }
fi

