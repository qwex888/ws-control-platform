#!/bin/sh
set -e

echo "[ws-control] starting ADB server..."
adb start-server 2>/dev/null || echo "[ws-control] WARN: adb start-server failed (no USB devices?)"
echo "[ws-control] ADB devices:"
adb devices 2>/dev/null || true

echo "[ws-control] starting nginx..."
nginx

echo "[ws-control] starting gateway on port ${PORT:-33721}..."
cd /app/services/gateway
exec tsx src/server.ts
