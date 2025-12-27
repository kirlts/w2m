#!/bin/sh
#
# W2M - Docker Entrypoint Script
#
# This script runs as root initially to adjust permissions,
# then switches to the w2m user to run the application.
#

# Check if we're running as root
if [ "$(id -u)" = "0" ]; then
    echo "🔧 Adjusting data directory permissions..."
    
    # Set permissions for data directories
    chmod -R 777 /app/data 2>/dev/null || true
    chown -R 1001:1001 /app/data 2>/dev/null || true
    
    # Ensure Google Drive service account file is readable
    if [ -f /app/data/googledrive/service-account.json ]; then
        chmod 644 /app/data/googledrive/service-account.json 2>/dev/null || true
        chown 1001:1001 /app/data/googledrive/service-account.json 2>/dev/null || true
    fi
    
    # Verify that session directory is writable
    if [ -d /app/data/session ]; then
        if touch /app/data/session/.test 2>/dev/null; then
            rm -f /app/data/session/.test
        else
            echo "⚠️  Warning: Cannot write to /app/data/session" >&2
        fi
    fi
    
    # Switch to w2m user and execute the application
    exec su-exec w2m node --max-old-space-size=1024 dist/index.js "$@"
else
    # Already running as w2m user, execute directly
    exec node --max-old-space-size=1024 dist/index.js "$@"
fi
