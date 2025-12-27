#!/bin/sh
#
# W2M - Fix Permissions Script
#
# This script adjusts permissions for mounted data directories.
# It runs when the container starts as root (setuid).
#

# If we're running as root (via setuid), adjust permissions
if [ "$(id -u)" = "0" ]; then
    # Adjust data directory permissions so w2m user can write
    chmod -R 777 /app/data 2>/dev/null || true
    chown -R 1001:1001 /app/data 2>/dev/null || true
fi

# Verify that the session directory is writable
if [ -d /app/data/session ]; then
    # Try to create a test file
    if touch /app/data/session/.test 2>/dev/null; then
        rm -f /app/data/session/.test
    else
        echo "⚠️  Warning: Cannot write to /app/data/session" >&2
        echo "   Run on host: chmod -R 777 data/session" >&2
    fi
fi
