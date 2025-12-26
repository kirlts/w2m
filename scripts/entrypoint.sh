#!/bin/sh
# Script de entrada que ajusta permisos y luego ejecuta la app como usuario w2m

# Si estamos como root, ajustar permisos
if [ "$(id -u)" = "0" ]; then
    echo "🔧 Ajustando permisos de directorios de datos..."
    chmod -R 777 /app/data 2>/dev/null || true
    chown -R 1001:1001 /app/data 2>/dev/null || true
    
    # Verificar que session es escribible
    if [ -d /app/data/session ]; then
        touch /app/data/session/.test 2>/dev/null && rm -f /app/data/session/.test || {
            echo "⚠️  Warning: No se pueden escribir en /app/data/session" >&2
        }
    fi
    
    # Cambiar al usuario w2m y ejecutar la app
    exec su-exec w2m node --max-old-space-size=1024 dist/index.js "$@"
else
    # Ya somos w2m, ejecutar directamente
    exec node --max-old-space-size=1024 dist/index.js "$@"
fi

